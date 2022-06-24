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
    const curLoc = curEntry.lastlocation;
    const prevLoc = prevEntry.lastlocation;
    const startLoc = new google.maps.LatLng({
      lat: prevLoc.rawlocation.latitude,
      lng: prevLoc.rawlocation.longitude,
    });
    const endLoc = new google.maps.LatLng({
      lat: curLoc.rawlocation.latitude,
      lng: curLoc.rawlocation.longitude,
    });
    this.entry = curEntry;
    this.prevEntry = prevEntry;
    this.interval = interval;
    this.startLoc = startLoc;
    this.startDate = prevEntry.date;
    this.endDate = curEntry.date;
    this.endLoc = endLoc;
    this.idx = idx;
    this.startVehicleState = _.get(curEntry, "jsonpayload.response.state");
    this.endVehicleState = _.get(prevEntry, "jsonpayload.response.state");
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
    if (!(this.startVehicleState && this.endVehicleState)) {
      // LMFS doesn't really have vehicle states -- what's interesing here?
      return "";
    }
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
    featureData.jsonpayload = {
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
    const avgInterval = _.mean(intervals);
    const medianInterval = Stats.median(intervals);
    const minInterval = _.min(intervals);
    const maxInterval = _.max(intervals);
    console.log("avgInterval", avgInterval);
    console.log("medianInterval", medianInterval);
    console.log("minInterval", minInterval);
    console.log("maxInterval", maxInterval);
    console.log("updateOutlier", updateOutlier);
    computedOutlier = _.min([medianInterval * 10, updateOutlier]);
    console.log("computedOutlier", computedOutlier);
    return _(updates)
      .filter((e) => e.interval >= computedOutlier)
      .sortBy("interval")
      .value();
  }
}
export { MissingUpdate as default };
