/*
 * vehicleData.js
 *
 * Load raw log data for easier consumption by other components.
 */
import TripLogs from "./TripLogs";
let jwt;
let projectId;
let apikey;
let mapId;
let solutionType;
let tripLogs;
import { getQueryStringValue } from "./queryString";

/**
 * This function must be called (and awaited on) to load the raw data before
 * any of the other exported fields are accessed.
 */
async function loadData() {
  const dataFileName = getQueryStringValue("dataFile") || "./data.json";
  const response = await fetch(dataFileName);
  const parsedData = await response.json();
  jwt = parsedData.jwt;
  projectId = parsedData.projectId;
  apikey = parsedData.APIKEY;
  mapId = parsedData.mapId;
  solutionType = parsedData.solutionType || "ODRD";
  tripLogs = new TripLogs(parsedData.rawLogs, solutionType);
}

export { loadData, tripLogs, apikey, mapId, jwt, projectId, solutionType };
