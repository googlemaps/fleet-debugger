/*
 * HighVelocityJump.js
 *
 * Representation of a HighVelocityJump
 */
import _ from "lodash";
const velocityOutlier = 68; // true velocities higher than this unlikely (in Meters/sec aprrox 150 MPH)
import Stats from "./Stats";
let computedOutlier = 0;

class HighVelocityJump {
  constructor(jumpIdx, prevEntry, curEntry) {
    const prevLoc = _.get(
      prevEntry,
      "jsonPayload.request.vehicle.lastLocation"
    );
    const curLoc = _.get(curEntry, "jsonPayload.request.vehicle.lastLocation");
    const startLoc = new google.maps.LatLng({
      lat: prevLoc.rawLocation.latitude,
      lng: prevLoc.rawLocation.longitude,
    });
    const endLoc = new google.maps.LatLng({
      lat: curLoc.rawLocation.latitude,
      lng: curLoc.rawLocation.longitude,
    });
    const distanceTraveled =
      window.google.maps.geometry.spherical.computeDistanceBetween(
        startLoc,
        endLoc
      );
    const timeSpentMS = curEntry.date - prevEntry.date;
    const velocity = distanceTraveled / (timeSpentMS / 1000.0);
    this.entry = curEntry;
    this.prevEntry = prevEntry;
    this.timeSpentMS = timeSpentMS;
    this.distanceTraveled = distanceTraveled;
    this.velocity = velocity;
    this.startLoc = startLoc;
    this.startDate = prevEntry.date;
    this.endDate = curEntry.date;
    this.endLoc = endLoc;
    this.jumpIdx = jumpIdx;
  }

  /*
   * Returns data about the jump to show in json viewer
   */
  getFeaturedData() {
    return {
      timeSpentMS: this.timeSpentMS,
      distanceTraveled: this.distanceTraveled,
      velocity: this.velocity,
      velocityMPH: this.velocity * 2.237,
      startLoc: this.startLoc.toString(),
      startDate: this.prevEntry.date,
      endDate: this.entry.date,
      endLoc: this.endLoc.toString(),
      jumpIdx: this.jumpIdx,
      date: this.entry.date,
      computedOutlierVelocity: computedOutlier,
    };
  }

  /*
   * returns blob of data suitable for viewing in
   * the log viewer
   */
  getLogViewerEntry() {
    const featureData = this.getFeaturedData();
    // Add properties necessary for logviewer to
    // function
    featureData.timestampMS = this.startDate.getTime();
    featureData.formattedDate = this.startDate.toISOString();
    featureData.jsonPayload = {
      "@type": "Jump",
      request: {
        vehicle: {
          lastLocation: {
            speed: this.velocity,
          },
        },
      },
    };
    return featureData;
  }

  /*
   * Filters jumps down to instances where the vehicle was
   * travelling at an unrealistic speed (either
   * greater that 150 MPH, or 100x median velocity).
   *
   * These numbers were chosen somewhat arbitrarily
   * based on a small dataset.
   */
  static getSignificantJumps(jumps) {
    if (!jumps) {
      return [];
    }
    const velocities = _.map(jumps, "velocity");
    const avgVelocity = _.mean(velocities);
    const medianVelocity = Stats.median(velocities);
    const minVelocity = _.min(velocities);
    const maxVelocity = _.max(velocities);
    console.log("avgVelocity", avgVelocity);
    console.log("medianVelocity", medianVelocity);
    console.log("minVelocity", minVelocity);
    console.log("maxVelocity", maxVelocity);
    computedOutlier = _.min([velocityOutlier, medianVelocity * 100]);
    return _(jumps)
      .filter((e) => e.velocity >= computedOutlier)
      .sortBy("velocity")
      .value();
  }
}
export { HighVelocityJump as default };