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

class TripLogs {
  constructor(rawLogs, solutionType) {
    this.solutionType = solutionType;
    if (this.solutionType === "LMFS") {
      this.updateVehicleSuffix = "update_delivery_vehicle";
      this.vehiclePath = "jsonPayload.request.deliveryVehicle";
      this.navStatusPropName = "navigationStatus";
    } else {
      this.updateVehicleSuffix = "update_vehicle";
      this.vehicleName = "vehicle";
      this.vehiclePath = "jsonPayload.request.vehicle";
      this.navStatusPropName = "navStatus";
    }
    this.lastLocationPath = this.vehiclePath + ".lastLocation";
    this.trip_ids = [];
    this.trips = [];
    this.tripStatusChanges = [];
    this.rawLogs = _.reverse(rawLogs);
    this.processTripSegments();
    if (rawLogs.length > 0) {
      this.minDate = new Date(rawLogs[0].timestamp);
      this.maxDate = new Date(_.last(rawLogs).timestamp);
    } else {
      this.minDate = new Date(0);
      this.maxDate = new Date();
    }
    this.velocityJumps = [];
    this.missingUpdates = [];
    this.dwellLocations = [];
    this.etaDeltas = [];

    //  annotate with Dates & timestapms
    _.map(this.rawLogs, (le, idx) => {
      le.date = new Date(le.timestamp);
      le.formattedDate = le.date.toISOString();
      le.timestampMS = le.date.getTime();
      le.idx = idx;
      // "synthetic" entries that hides some of the differences
      // between lmfs & odrd log entries
      le.lastLocation = _.get(le, this.lastLocationPath);

      // utilized for calculations of serve/client time deltas (where the
      // server time isn't populated in the request).
      le.lastLocationResponse = _.get(le, "jsonPayload.response.lastLocation");

      // use the response because nav status is typically only
      // in the request when it changes ... and visualizations
      // make more sense when the nav status can be shown along the route
      le.navStatus = _.get(
        le,
        "jsonPayload.response." + this.navStatusPropName
      );
    });
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
      .filter((le) => _.get(le, this.lastLocationPath + ".rawLocation"))
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
          _.get(le, this.vehiclePath + ".etaToFirstWaypoint") &&
          _.get(le, this.lastLocationPath + ".rawLocation")
      )
      .map((curEntry) => {
        let ret;
        if (prevEntry) {
          const curLoc = _.get(curEntry, this.lastLocationPath);

          ret = {
            deltaInSeconds: (curEntry.date - prevEntry.date) / 1000,
            coords: new google.maps.LatLng({
              lat: curLoc.rawLocation.latitude,
              lng: curLoc.rawLocation.longitude,
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
      .filter((le) => _.get(le, this.lastLocationPath + ".rawLocation"))
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
      const lastLocation = le.lastLocation;
      if (
        !lastLocation ||
        !lastLocation.rawLocation ||
        le.date < minDate ||
        le.date > maxDate
      ) {
        return;
      }
      const coord = {
        lat: lastLocation.rawLocation.latitude,
        lng: lastLocation.rawLocation.longitude,
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
        "jsonPayload.response.remainingVehicleJourneySegments"
      );
      return stopsLeft && "Stops Left " + stopsLeft.length;
    } else {
      return _.get(logEntry, "labels.trip_id");
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
      if (le.logName.match(this.updateVehicleSuffix)) {
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
        } else {
          curTripData.lastUpdate = new Date(le.timestamp);
          curTripData.tripDuration =
            curTripData.lastUpdate - curTripData.firstUpdate;
          curTripData.updateRequests++;
        }
        const lastLocation = _.get(le, this.lastLocationPath);
        if (lastLocation && lastLocation.rawLocation) {
          curTripData.appendCoords(lastLocation, le.timestamp);
        }
      }
      const tripStatus = _.get(le, "jsonPayload.response.status");
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
