/*
 * vehicleData.js
 *
 * Load raw log data for easier consumption by other components.
 */
import TripLogs from "./TripLogs";
let jwt;
let projectId;
let apikey;
let solutionType;
let tripLogs;

/**
 * This function must be called (and awaited on) to load the raw data before
 * any of the other exported fields are accessed.
 */
async function loadData() {
  const response = await fetch("./data.json");
  const parsedData = await response.json();
  jwt = parsedData.jwt;
  projectId = parsedData.projectId;
  apikey = parsedData.APIKEY;
  solutionType = parsedData.solutionType;
  tripLogs = new TripLogs(parsedData.rawLogs, solutionType);
}

export { loadData, tripLogs, apikey, jwt, projectId, solutionType };
