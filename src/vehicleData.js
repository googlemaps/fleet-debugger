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
const jwt = parsedJsonData.jwt;
const projectId = parsedJsonData.projectId;
const apikey = parsedJsonData.APIKEY;
const solutionType = parsedJsonData.solutionType;

//TODO refactor log processing, remove logic from
//Map.js, expose things ilke groupingLabel?
//const groupingLabel = solutionType === "ODRD" ? "trip_id" : "task_id";
const updateVehicleSuffix =
  solutionType === "LMFS" ? "update_delivery_vehicle" : "update_vehicle";

// TODO: handle non-trip segments (ie online, but not trip
// assigned).
const pathCoords = _(parsedJsonData.rawLogs)
  .filter(
    (l) =>
      l.logName.endsWith(updateVehicleSuffix) &&
      _.get(l, "jsonPayload.response.lastLocation.rawLocation")
  )
  .map((l) => {
    const lastLocation = l.jsonPayload.response.lastLocation;
    return {
      lat: lastLocation.rawLocation.latitude,
      lng: lastLocation.rawLocation.longitude,
      trip_id: l.labels.trip_id,
      task_id: l.labels.task_id,
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

export { rawLogs as default, pathCoords, apikey, jwt, projectId, solutionType };
