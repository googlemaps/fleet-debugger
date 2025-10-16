// src/Trip.js

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
    this.logs = [];
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
      lat: lastLocation.location.latitude,
      lng: lastLocation.location.longitude,
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

  getPointFromLogs(path, useLatest) {
    if (!this.logs || this.logs.length === 0) {
      return null;
    }

    const sortedLogs = useLatest ? _.sortBy(this.logs, "timestampMS").reverse() : this.logs;
    for (const log of sortedLogs) {
      const point = _.get(log, `response.${path}`);
      if (point) {
        return point;
      }
    }
    return null;
  }

  getPickupPoint() {
    return this.getPointFromLogs("pickuppoint.point", true);
  }

  getDropoffPoint() {
    return this.getPointFromLogs("dropoffpoint.point", true);
  }

  getActualPickupPoint() {
    return this.getPointFromLogs("actualpickuppoint.point", false);
  }

  getActualDropoffPoint() {
    return this.getPointFromLogs("actualdropoffpoint.point", false);
  }
}

/*
 * Deterministically assign a color per trip using tripIdx
 * Colors were chosen for visibility
 */
export function getColor(tripIdx) {
  const colors = [
    "#0dcaf0", // Cyan
    "#97cc04", // Lime Green
    "#198754", // Green
    "#6A0DAD", // Purple
    "#FA8072", // Salmon
    "#8B4513", // Brown
    "#d63384", // Magenta
    "#f45d01", // Orange
    "#fdc500", // Gold
  ];
  return colors[tripIdx % colors.length];
}

export { Trip as default };
