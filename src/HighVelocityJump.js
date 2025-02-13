// src/HighVelocityJump.js

import _ from "lodash";
const velocityOutlier = 68; // true velocities higher than this unlikely (in Meters/sec aprrox 150 MPH)
import Stats from "./Stats";
let computedOutlier = 0;

class HighVelocityJump {
  constructor(jumpIdx, prevEntry, curEntry) {
    const prevLoc = prevEntry.lastlocation;
    const curLoc = curEntry.lastlocation;
    const startLoc = new google.maps.LatLng({
      lat: prevLoc.rawlocation.latitude,
      lng: prevLoc.rawlocation.longitude,
    });
    const endLoc = new google.maps.LatLng({
      lat: curLoc.rawlocation.latitude,
      lng: curLoc.rawlocation.longitude,
    });

    const distanceTraveled = window.google.maps.geometry.spherical.computeDistanceBetween(startLoc, endLoc);
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
    this.isSignificant = this.distanceTraveled > 1;
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
    featureData.lastlocation = {
      speed: this.velocity,
    };
    featureData["@type"] = "Jump";
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
    if (!jumps || jumps.length === 0) {
      console.log("No jumps to process");
      return [];
    }

    const velocities = jumps.map((jump) => jump.velocity);
    const avgVelocity = _.mean(velocities);
    const medianVelocity = Stats.median(velocities);
    const stdDevVelocity = Math.sqrt(_.mean(velocities.map((v) => Math.pow(v - avgVelocity, 2))));

    console.log("avgVelocity", avgVelocity);
    console.log("medianVelocity", medianVelocity);
    console.log("stdDevVelocity", stdDevVelocity);

    // Consider a jump significant if:
    // 1. Its velocity is greater than the median + 2 standard deviations
    // 2. OR its velocity is greater than velocityOutlier (150 MPH)
    // 3. AND the distance traveled is more than 1 meter
    const significantThreshold = Math.min(medianVelocity + 2 * stdDevVelocity, velocityOutlier);

    const significantJumps = jumps.filter(
      (jump) =>
        (jump.velocity > significantThreshold || jump.velocity > velocityOutlier) &&
        jump.distanceTraveled > 1 &&
        jump.timeSpentMS > 0 // Ensure we're not dividing by zero
    );

    console.log(`Found ${significantJumps.length} significant jumps`);
    return significantJumps;
  }
}

export { HighVelocityJump as default };
