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
const rawLogs = _.reverse(parsedJsonData.rawLogs);
const jwt = parsedJsonData.jwt;
const projectId = parsedJsonData.projectId;
const apikey = parsedJsonData.APIKEY;
const solutionType = parsedJsonData.solutionType;
import TripLogs from "./TripLogs";

//  annotate with Dates & timestapms
_.map(rawLogs, (le) => {
  le.date = new Date(le.timestamp);
  le.formattedDate = le.date.toString();
  le.timestampMS = le.date.getTime();
});

const tripLogs = new TripLogs(rawLogs, solutionType);
export { tripLogs, apikey, jwt, projectId, solutionType };
