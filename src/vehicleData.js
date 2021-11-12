/*
 * vehicleData.js
 *
 * Processes raw log data for easier consumption by other components.
 * In theory this could be done serverside & placed into rawData, but
 * it's easier to iterate on features when the raw log data doesn't need
 * to be regenerated each time
 */
import _ from "lodash";
import parsedJsonData from "./rawData";
const rawLogs = parsedJsonData.rawLogs;
// TODO: handle non-trip segments (ie online, but not trip
// assigned).
const pathCoords = _(parsedJsonData.rawLogs)
  .filter(
    (l) =>
      l.logName.endsWith("update_vehicle") &&
      _.get(l, "jsonPayload.response.lastLocation.rawLocation")
  )
  .map((l) => {
    const lastLocation = l.jsonPayload.response.lastLocation;
    return {
      lat: lastLocation.rawLocation.latitude,
      lng: lastLocation.rawLocation.longitude,
      trip_id: l.labels.trip_id,
      date: new Date(l.timestamp),
    };
  })
  .value();
//  annotate with Dates & timestapms
_.map(rawLogs, (le) => {
  le.date = new Date(le.timestamp);
  le.formattedDate = le.date.toString();
  le.timestampMS = le.date.getTime();
});

const apikey = parsedJsonData.APIKEY;

export { rawLogs as default, pathCoords, apikey };
