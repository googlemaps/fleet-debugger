/*
 * TripLogs.js
 *
 * Processes raw logs into 'trip segments'.  A trip segment might
 * be an individual trip, a contiguous non-trip region, or the route
 * between two LMFS stops.
 */
import _ from "lodash";
import Trip from "./Trip";
import HighVelocityJump from "./HighVelocityJump";
import MissingUpdate from "./MissingUpdate";

const maxDistanceForDwell = 20; // meters
const requiredUpdatesForDwell = 12; // aka 2 minute assuming update vehicle request at 10 seconds
const apis = new Set([
  "createVehicle",
  "getVehicle",
  "updateVehicle",
  "createDeliveryVehicle",
  "getDeliveryVehicle",
  "updateDeliveryVehicle",
  "createTrip",
  "getTrip",
  "updateTrip",
  "createTask",
  "getTask",
  "updateTask",
]);

/* Logs from bigquery will be all lower case, so standardize on that
 */
function toLowerKeys(input) {
  if (typeof input !== "object") {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(toLowerKeys);
  }
  return Object.keys(input).reduce((newObj, key) => {
    let val = input[key];
    let newVal =
      typeof val === "object" && val !== null ? toLowerKeys(val) : val;
    newObj[key.toLowerCase()] = newVal;
    return newObj;
  }, {});
}

function processApiCall(origLog) {
  let apiType;
  if (origLog.jsonpayload) {
    apiType = origLog.jsonpayload["@type"];
    for (const api of apis) {
      const regex = new RegExp(`.*${api}.*`, "i");
      if (apiType.match(regex)) {
        return {
          api: api,
          request: origLog.jsonpayload.request,
          response: origLog.jsonpayload.response,
        };
      }
    }
  } else {
    for (const key of Object.keys(origLog)) {
      for (const api of apis) {
        const regex = new RegExp(`.*${api}.*`, "i");
        if (key.match(regex)) {
          return {
            api: api,
            request: origLog[key].request,
            response: origLog[key].response,
          };
        }
      }
    }
  }
  throw new SyntaxError(
    `Could not find API call type for log entry: ${JSON.stringify(origLog)}`
  );
}

function adjustFieldFormat(log, origPath, newPath, stringToTrim) {
  const origVal = _.get(log, origPath);
  if (origVal) {
    let newVal;
    if (Array.isArray(origVal)) {
      newVal = origVal.map((val) =>
        typeof val === "string" ? val.replace(stringToTrim, "") : val
      );
    } else {
      newVal =
        typeof origVal === "string"
          ? origVal.replace(stringToTrim, "")
          : origVal;
    }
    // Delete the property first since the new path could equal the original path
    _.unset(log, origPath);
    _.set(log, newPath, newVal);
  }
}

function processRawLogs(rawLogs, solutionType) {
  const origLogs = _.reverse(rawLogs.map(toLowerKeys));
  const newLogs = origLogs.map((origLog, idx) => {
    const newLog = {};
    // Create timestamp entries
    newLog.timestamp = origLog.timestamp || origLog.servertime;
    newLog.date = new Date(newLog.timestamp);
    newLog.formattedDate = newLog.date.toISOString();
    newLog.timestampMS = newLog.date.getTime();
    newLog.idx = idx;

    // Create api call name entry
    const apiCall = processApiCall(origLog);
    newLog["@type"] = apiCall.api;

    // Copy request and response
    newLog.request = apiCall.request;
    newLog.response = apiCall.response;

    // Update known log differences to standard Fleet Archive form
    adjustFieldFormat(
      newLog,
      "request.vehicle.state",
      "request.vehicle.vehiclestate",
      "VEHICLE_STATE_"
    );
    adjustFieldFormat(
      newLog,
      "request.vehicle.lastlocation.locsensor",
      "request.vehicle.lastlocation.locationsensor",
      "LOCATION_SENSOR_"
    );
    adjustFieldFormat(
      newLog,
      "request.vehicle.lastlocation.bearingaccuracy",
      "request.vehicle.lastlocation.headingaccuracy"
    );
    adjustFieldFormat(
      newLog,
      "response.vehicletype.vehiclecategory",
      "response.vehicletype.category"
    );
    adjustFieldFormat(
      newLog,
      "response.supportedtrips",
      "response.supportedtriptypes",
      "_TRIP"
    );
    adjustFieldFormat(
      newLog,
      "response.navigationstatus",
      "response.navigationstatus",
      "NAVIGATION_STATUS_"
    );
    adjustFieldFormat(
      newLog,
      "response.navstatus",
      "response.navigationstatus",
      "NAVIGATION_STATUS_"
    );
    adjustFieldFormat(
      newLog,
      "response.lastlocation.locsensor",
      "response.lastlocation.locationsensor",
      "LOCATION_SENSOR_"
    );
    adjustFieldFormat(
      newLog,
      "response.status",
      "response.tripstatus",
      "TRIP_STATUS_"
    );
    // ODRD uses "state" or "vehiclestate" for vehicle state.
    // LMFS uses "state" for task state.
    if (solutionType == "ODRD") {
      adjustFieldFormat(
        newLog,
        "response.state",
        "response.vehiclestate",
        "VEHICLE_STATE_"
      );
    }

    return newLog;
  });
  return newLogs;
}

class TripLogs {
  constructor(rawLogs, solutionType) {
    this.solutionType = solutionType;
    if (this.solutionType === "LMFS") {
      this.vehiclePath = "request.deliveryvehicle";
    } else {
      this.vehiclePath = "request.vehicle";
    }
    this.trip_ids = [];
    this.trips = [];
    this.tripStatusChanges = [];
    this.rawLogs = processRawLogs(rawLogs, solutionType);
    this.velocityJumps = [];
    this.missingUpdates = [];
    this.dwellLocations = [];
    this.etaDeltas = [];

    const lastLocationPath = this.vehiclePath + ".lastlocation";
    _.map(this.rawLogs, (le) => {
      // "synthetic" entries that hides some of the differences
      // between lmfs & odrd log entries
      le.lastlocation = _.get(le, lastLocationPath);

      // utilized for calculations of serve/client time deltas (where the
      // server time isn't populated in the request).
      le.lastlocationResponse = _.get(le, "response.lastlocation");

      // use the response because nav status is typically only
      // in the request when it changes ... and visualizations
      // make more sense when the nav status can be shown along the route
      le.navStatus = _.get(le, "response.navigationstatus");

      // Sort currentTrips array since sometimes it could contain multiple trip ids
      // but in a random order
      if (_.get(le, "response.currenttrips")) {
        le.response.currenttrips.sort();
      }
    });

    if (this.rawLogs.length > 0) {
      this.minDate = this.rawLogs[0].date;
      this.maxDate = _.last(this.rawLogs).date;
    } else {
      this.minDate = new Date(0);
      this.maxDate = new Date();
    }
    this.processTripSegments();
  }

  getRawLogs_(minDate, maxDate) {
    minDate = minDate || this.minDate;
    maxDate = maxDate || this.maxDate;
    return _(this.rawLogs).filter(
      (le) => le.date >= minDate && le.date <= maxDate
    );
  }

  getLogs_(minDate, maxDate) {
    return this.getRawLogs_(minDate, maxDate)
      .concat(this.velocityJumps.map((j) => j.getLogViewerEntry()))
      .concat(this.missingUpdates.map((u) => u.getLogViewerEntry()))
      .filter((le) => le.date >= minDate && le.date <= maxDate)
      .sortBy("timestampMS");
  }

  getTripStatusChanges() {
    return this.tripStatusChanges;
  }

  getTripStatusAtDate(date) {
    const idx = _.sortedIndexBy(this.tripStatusChanges, { date }, "date");
    if (idx >= 1) {
      return this.tripStatusChanges[idx - 1].newStatus;
    }
  }

  getTripIDs() {
    // TODO: do time filtering heree
    return this.trip_ids;
  }

  getTrips() {
    // TODO: do time filtering heree
    return this.trips;
  }

  /*
   * Vehicles should be updating positions every 5 seconds
   * (configurable?).  Compute places where updates are missing.
   * aka "Temporal jumps".  This will be places where the
   * app crashed, the user went off line, lost cell signal, etc.
   */
  getMissingUpdates(minDate, maxDate) {
    let prevEntry;
    let entries = this.getRawLogs_(minDate, maxDate)
      .filter((le) => _.get(le, "lastlocation.rawlocation"))
      .map((curEntry) => {
        let ret;
        if (prevEntry) {
          ret = new MissingUpdate(curEntry.idx, prevEntry, curEntry);
        }

        prevEntry = curEntry;
        return ret;
      })
      .compact()
      .value();

    this.missingUpdates = MissingUpdate.getSignificantMissingUpdates(entries);
    return this.missingUpdates;
  }

  /*
   * Compute change in ETA to first waypoint across all location
   * updates.
   */
  getETADeltas(minDate, maxDate) {
    let prevEntry;
    this.etaDeltas = this.getRawLogs_(minDate, maxDate)
      .filter(
        (le) =>
          _.get(le, this.vehiclePath + ".etatofirstwaypoint") &&
          _.get(le, "lastlocation.rawlocation")
      )
      .map((curEntry) => {
        let ret;
        if (prevEntry) {
          const curLoc = _.get(curEntry, "lastlocation");

          ret = {
            deltaInSeconds: (curEntry.date - prevEntry.date) / 1000,
            coords: new google.maps.LatLng({
              lat: curLoc.rawlocation.latitude,
              lng: curLoc.rawlocation.longitude,
            }),
          };
        }

        prevEntry = curEntry;
        return ret;
      })
      .compact()
      .value();

    return this.etaDeltas;
  }

  /*
   * Computes & returns jumps where the vehicle moved
   * at an unrealistic velocity.
   */
  getHighVelocityJumps(minDate, maxDate) {
    let prevEntry;
    let entries = this.getRawLogs_(minDate, maxDate)
      .filter((le) => _.get(le, "lastlocation.rawlocation"))
      .map((curEntry) => {
        let ret;
        if (prevEntry) {
          ret = new HighVelocityJump(curEntry.idx, prevEntry, curEntry);
        }

        prevEntry = curEntry;
        return ret;
      })
      .compact()
      .value();

    this.velocityJumps = HighVelocityJump.getSignificantJumps(entries);
    return this.velocityJumps;
  }

  /*
   * Rudimentary dwell location compution.  A lot of issues:
   *    - Uses size of circle to represent dwell times ... which is confusing
   *      w.r.t which points make up this cluster. (ie overlapping circles when
   *      dwell locations are close by).  Should those dwell locations merged?
   *    - Doesn't compute an actual dwell time, instead assumes UpdateVehicle requests
   *      are 10 seconds apart
   *    - A cluster should be within maxDistanceForDwell as well as maxTime in order to be considered
   *      (right now clusters can be created at a location where multiple trips over days cross)
   *    - dwell times are fuzzy. Sliders for the time & distance components might be interesting
   *    - Doesn't respect min/max time filters from the time slider
   *    - computation of dwell times is slow -- should cache results when turning on & off to avoid
   *      unnecessary precomputation
   *    - dwellLocations could be sarted by time to improve cluster lookup
   *
   *  See https://stackoverflow.com/questions/36928654/leader-clustering-algorithm-explanation for a
   *  description of the very simplistic algo used here.
   */
  getDwellLocations(minDate, maxDate) {
    const dwellLocations = [];
    _.forEach(this.rawLogs, (le) => {
      const lastLocation = le.lastlocation;
      if (
        !lastLocation ||
        !lastLocation.rawlocation ||
        le.date < minDate ||
        le.date > maxDate
      ) {
        return;
      }
      const coord = {
        lat: lastLocation.rawlocation.latitude,
        lng: lastLocation.rawlocation.longitude,
      };
      const cluster = _.find(
        dwellLocations,
        (dl) =>
          window.google.maps.geometry.spherical.computeDistanceBetween(
            dl.leaderCoords,
            new google.maps.LatLng(coord)
          ) <= maxDistanceForDwell
      );
      if (cluster) {
        cluster.updates++;
        cluster.endDate = le.date;
      } else {
        dwellLocations.push({
          leaderCoords: new window.google.maps.LatLng(coord),
          updates: 1,
          startDate: le.date,
        });
      }
    });

    this.dwellLocations = _.filter(
      dwellLocations,
      (dl) => dl.updates >= requiredUpdatesForDwell
    );

    return this.dwellLocations;
  }

  getSegmentID(logEntry) {
    if (this.solutionType === "LMFS") {
      const stopsLeft = _.get(
        logEntry,
        "response.remainingvehiclejourneysegments"
      );
      return stopsLeft && "Stops Left " + stopsLeft.length;
    } else {
      const currentTrips = _.get(logEntry, "response.currenttrips");
      if (currentTrips) {
        return currentTrips.join();
      }
    }
  }

  processTripSegments() {
    let curTripId = "this is not a segment";
    let curTripData = undefined;
    let tripIdx = 0;
    let nonTripIdx = 0;
    let lastTripStatus = "no status";
    // assumes logs are already sorted
    // also assumes out-of-order updates can't happen.  Unclear
    // if this is a good assumption, but it might be worth it to call out
    // places where it happens (since that might actually be a client bug).

    _.forEach(this.rawLogs, (le) => {
      if (
        le["@type"] === "updateVehicle" ||
        le["@type"] === "updateDeliveryVehicle"
      ) {
        const newTripId = this.getSegmentID(le);
        if (newTripId !== curTripId) {
          curTripId = newTripId;
          const tripName = newTripId
            ? newTripId
            : "non-trip-segment-" + nonTripIdx;
          curTripData = new Trip(tripIdx, tripName, new Date(le.timestamp));
          this.trips.push(curTripData);
          this.trip_ids.push(curTripData.tripName);

          tripIdx++;
          if (newTripId === undefined) {
            nonTripIdx++;
          }
          const plannedPath = _.get(
            le,
            "response.remainingvehiclejourneysegments[0].path"
          );
          if (plannedPath && plannedPath.length > 0) {
            curTripData.setPlannedPath(plannedPath);
          }
        } else {
          curTripData.lastUpdate = new Date(le.timestamp);
          curTripData.tripDuration =
            curTripData.lastUpdate - curTripData.firstUpdate;
          curTripData.updateRequests++;
        }
        const lastLocation = le.lastlocation;
        if (lastLocation && lastLocation.rawlocation) {
          curTripData.appendCoords(lastLocation, le.timestamp);
        }
      }
      const tripStatus = _.get(le, "response.tripstatus");
      // if the logs had a trip status, and it changeed update
      if (tripStatus && tripStatus !== lastTripStatus) {
        this.tripStatusChanges.push({
          newStatus: tripStatus,
          date: new Date(le.timestamp),
        });
        lastTripStatus = tripStatus;
      }
    });
  }
}

export { TripLogs as default };
