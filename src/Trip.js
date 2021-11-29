/*
 * Trip.js
 *
 * Processed log for a trip. Currently only includes very basic information
 * about the trip
 */
import _ from "lodash";

class Trip {
  constructor(tripIdx, tripName, firstUpdateTime) {
    this.tripIdx = tripIdx;
    this.tripName = tripName;
    this.firstUpdateTime = firstUpdateTime;
    this.updateRequests = 1;
    this.pathCoords = [];
    this.tripDuration = 0;
    this.creationTime = "Unknown";
    this.lastUpdateTime = "Unknown";
  }

  getFormatDuration() {
    let sec_num = this.tripDuration / 1000;
    let hours = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - hours * 3600) / 60);
    let seconds = Math.floor(sec_num - hours * 3600 - minutes * 60);
    let timeStr = "";

    if (hours > 0) {
      timeStr += hours + " hours ";
    }
    if (minutes > 0) {
      timeStr += minutes + " minutes ";
    }
    if (seconds > 0) {
      timeStr += seconds + " seconds";
    }
    return timeStr;
  }

  /*
   * Returns data about trip to show in json viewer
   */
  getFeaturedData() {
    return {
      updateRequests: this.updateRequests,
      tripName: this.tripName,
      duration: this.getFormatDuration(),
      creationTime: this.creationTime,
      firstUpdateTime: this.firstUpdateTime,
      lastUpdateTime: this.lastUpdateTime,
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
      lat: lastLocation.rawLocation.latitude,
      lng: lastLocation.rawLocation.longitude,
      trip_id: this.tripName,
      date: new Date(timestamp),
    });
  }
}
export { Trip as default };
