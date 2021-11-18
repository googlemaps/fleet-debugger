/*
 * TripLogs.js
 *
 * Processes raw logs into 'trip segments'.  A trip segment might
 * be an individual trip, a contiguous non-trip region, or the route
 * between two LMFS stops.
 */
import _ from "lodash";
import Trip from "./Trip";

const maxDistanceForDwell = 20; // meters
const requiredUpdatesForDwell = 12; // aka 2 minute assuming update vehicle request at 10 seconds

class TripLogs {
  constructor(rawLogs, solutionType) {
    this.solutionType = solutionType;
    this.updateVehicleSuffix =
      this.solutionType === "LMFS"
        ? "update_delivery_vehicle"
        : "update_vehicle";
    this.trip_ids = [];
    this.trips = [];
    this.tripStatusChanges = [];
    this.rawLogs = rawLogs;
    this.processTripSegments();
    this.minDate = new Date(rawLogs[0].timestamp);
    this.maxDate = new Date(_.last(rawLogs).timestamp);
  }

  getRawLogs_(minDate, maxDate) {
    minDate = minDate || this.minDate;
    maxDate = maxDate || this.maxDate;
    return _(this.rawLogs).filter(
      (le) => le.date >= minDate && le.date <= maxDate
    );
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
      const lastLocation = _.get(le, "jsonPayload.response.lastLocation");
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
      } else {
        dwellLocations.push({
          leaderCoords: new window.google.maps.LatLng(coord),
          updates: 1,
        });
      }
    });

    return _.filter(
      dwellLocations,
      (dl) => dl.updates >= requiredUpdatesForDwell
    );
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
          curTripData.lastUpdateTime = new Date(le.timestamp);
          curTripData.tripDuration =
            curTripData.lastUpdateTime - curTripData.firstUpdateTime;
          curTripData.updateRequests++;
        }
        const lastLocation = le.jsonPayload.response.lastLocation;
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
