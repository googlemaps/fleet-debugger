/*
 * src/Trip.js
 *
 * Processed log for a trip. Currently only includes very basic information
 * about the trip
 */
import _ from "lodash";
import Utils from "./Utils";

class Trip {
  constructor(tripIdx, tripName, firstUpdate) {
    this.tripIdx = tripIdx;
    this.tripName = tripName;
    this.updateRequests = 1;
    this.pathCoords = [];
    this.tripDuration = 0;
    this.creationTime = "Unknown";
    this.firstUpdate = firstUpdate;
    this.lastUpdate = "Unknown";
    this.plannedPath = [];
  }

  getTraveledDistance() {
    return window.google.maps.geometry.spherical.computeLength(this.pathCoords);
  }

  /*
   * Returns data about trip to show in json viewer
   */
  getFeaturedData() {
    return {
      updateRequests: this.updateRequests,
      tripName: this.tripName,
      duration: Utils.formatDuration(this.tripDuration),
      creationTime: this.creationTime,
      traveledDistanceKilometers: this.getTraveledDistance() / 1000,
      traveledDistanceMiles: this.getTraveledDistance() / 1609,
      firstUpdate: this.firstUpdate,
      lastUpdate: this.lastUpdate,
    };
  }

  getPathCoords(minDate, maxDate) {
    if (!(minDate && maxDate)) {
      return this.pathCoords;
    }
    return _(this.pathCoords)
      .filter((le) => {
        return le.date >= minDate && le.date <= maxDate;
      })
      .value();
  }

  // append full raw log? would make downstream processing easier
  // or synthesize pathCoords on the fly?
  appendCoords(lastLocation, timestamp) {
    this.pathCoords.push({
      lat: lastLocation.rawlocation.latitude,
      lng: lastLocation.rawlocation.longitude,
      trip_id: this.tripName,
      date: new Date(timestamp),
    });
  }

  setPlannedPath(plannedPath) {
    this.plannedPath = plannedPath.map((coords) => {
      return { lat: coords.latitude, lng: coords.longitude };
    });
  }

  getPlannedPath() {
    return this.plannedPath;
  }

  getPoint(type, path) {
    return _.get(
      _.find(this.logs, (log) => log["@type"] === type && _.get(log, path)),
      path
    );
  }

  getPickupPoint() {
    return this.getPoint("createTrip", "request.trip.pickuppoint.point");
  }

  getDropoffPoint() {
    return this.getPoint("createTrip", "request.trip.dropoffpoint.point");
  }

  getActualPickupPoint() {
    return this.getPoint("updateTrip", "response.actualpickuppoint.point");
  }

  getActualDropoffPoint() {
    return this.getPoint("updateTrip", "response.actualdropoffpoint.point");
  }
}

/*
 * Deterministically assign a color per trip using tripIdx
 * Colors were chosen for visibility
 */
export function getColor(tripIdx) {
  const colors = ["#2d7dd2", "#97cc04", "#eeb902", "#f45d01", "#474647", "00aa00"];
  return colors[tripIdx % colors.length];
}

export { Trip as default };
