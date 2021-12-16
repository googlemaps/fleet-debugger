/*
 * vehicleData.js
 *
 * Processes raw log data for easier consumption by other components.
 * In theory this could be done serverside & placed into rawData, but
 * it's easier to iterate on features when the raw log data doesn't need
 * to be regenerated each time
 */
import _ from "lodash";
import { parsedData } from "./rawData";
const rawLogs = _.reverse(parsedData.rawLogs);
const jwt = parsedData.jwt;
const projectId = parsedData.projectId;
const apikey = parsedData.APIKEY;
const solutionType = parsedData.solutionType;
import TripLogs from "./TripLogs";

//  annotate with Dates & timestapms
_.map(rawLogs, (le, idx) => {
  le.date = new Date(le.timestamp);
  le.formattedDate = le.date.toISOString();
  le.timestampMS = le.date.getTime();
  le.idx = idx;
});

const tripLogs = new TripLogs(rawLogs, solutionType);
export { tripLogs, apikey, jwt, projectId, solutionType };
