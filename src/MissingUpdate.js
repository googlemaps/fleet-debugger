/*
 * MissingUpdate.js
 *
 * Representation of a missing update
 */
import _ from "lodash";
const updateOutlier = 60000; // 60 seconds
import Stats from "./Stats";
import Utils from "./Utils";
let computedOutlier = 0;

class MissingUpdate {
  constructor(idx, prevEntry, curEntry) {
    const interval = curEntry.date - prevEntry.date;
    const curLoc = curEntry.lastLocation;
    const prevLoc = prevEntry.lastLocation;
    const startLoc = new google.maps.LatLng({
      lat: prevLoc.rawLocation.latitude,
      lng: prevLoc.rawLocation.longitude,
    });
    const endLoc = new google.maps.LatLng({
      lat: curLoc.rawLocation.latitude,
      lng: curLoc.rawLocation.longitude,
    });
    this.entry = curEntry;
    this.prevEntry = prevEntry;
    this.interval = interval;
    this.startLoc = startLoc;
    this.startDate = prevEntry.date;
    this.endDate = curEntry.date;
    this.endLoc = endLoc;
    this.idx = idx;
    this.startVehicleState = _.get(curEntry, "jsonPayload.response.state");
    this.endVehicleState = _.get(prevEntry, "jsonPayload.response.state");
    this.duration = Utils.formatDuration(this.interval);
  }

  /*
   * Returns data about the update to show in json viewer
   */
  getFeaturedData() {
    return {
      duration: this.duration,
      interval: this.interval,
      startDate: this.startDate,
      startLoc: this.startLoc.toString(),
      endDate: this.endDate,
      endLoc: this.endLoc.toString(),
      startVehicleState: this.startVehicleState,
      endVehicleState: this.endVehicleState,
      computedOutlier: Utils.formatDuration(computedOutlier),
    };
  }

  /*
   * format a vehicle state transitino into something a
   * human can easily read.
   */
  getStateTransition() {
    const start = this.startVehicleState.replace("VEHICLE_STATE_", "");
    const end = this.endVehicleState.replace("VEHICLE_STATE_", "");
    return start + ">" + end;
  }

  /*
   * returns blob of data suitable for viewing in
   * the log viewer
   */
  getLogViewerEntry() {
    const featureData = this.getFeaturedData();
    // Add properties necessary for logviewer to
    // function
    featureData.date = this.startDate;
    featureData.timestampMS = this.startDate.getTime();
    featureData.formattedDate = this.startDate.toISOString();
    featureData.jsonPayload = {
      "@type": "Missing Updates",
      temporal_gap: featureData.duration,
      response: {
        state: this.getStateTransition(),
      },
    };
    return featureData;
  }

  /*
   * Filters updates down to instances where now updates
   * were received from the vehicle for either 60 seconds
   * or 10x the median observed update (our default
   * update is every 5 seconds).
   *
   * These numbers were chosen somewhat arbitrarily
   * based on a small dataset.
   */
  static getSignificantMissingUpdates(updates) {
    if (!updates) {
      return [];
    }
    const intervals = _.map(updates, "interval");
    const avgInternal = _.mean(intervals);
    const medianInternal = Stats.median(intervals);
    const minInternal = _.min(intervals);
    const maxInternal = _.max(intervals);
    console.log("avgInternal", avgInternal);
    console.log("medianInternal", medianInternal);
    console.log("minInternal", minInternal);
    console.log("maxInternal", maxInternal);
    console.log("updateOutlier", updateOutlier);
    computedOutlier = _.min([medianInternal * 10, updateOutlier]);
    console.log("computedOutlier", computedOutlier);
    return _(updates)
      .filter((e) => e.interval >= computedOutlier)
      .sortBy("interval")
      .value();
  }
}
export { MissingUpdate as default };
