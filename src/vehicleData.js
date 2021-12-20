/*
 * vehicleData.js
 *
 * Load raw log data for easier consumption by other components.
 * In theory this could be done serverside & placed into rawData, but
 * it's easier to iterate on features when the raw log data doesn't need
 * to be regenerated each time
 */
import { parsedData } from "./rawData";
const rawLogs = parsedData.rawLogs;
const jwt = parsedData.jwt;
const projectId = parsedData.projectId;
const apikey = parsedData.APIKEY;
const solutionType = parsedData.solutionType;
import TripLogs from "./TripLogs";

const tripLogs = new TripLogs(rawLogs, solutionType);
export { tripLogs, apikey, jwt, projectId, solutionType };
