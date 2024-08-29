/*
 * vehicleData.js
 *
 * Load raw log data for easier consumption by other components.
 */
import TripLogs from "./TripLogs";
import TaskLogs from "./TaskLogs";
import { getUploadedData } from "./localStorage";
import { getQueryStringValue } from "./queryString";
import { DEFAULT_API_KEY, DEFAULT_MAP_ID } from "./constants";

let jwt;
let projectId;
let apikey;
let mapId;
let solutionType;
let tripLogs;
let taskLogs;

async function loadData() {
  let parsedData;

  // Try to get uploaded data from IndexedDB
  for (let i = 0; i < 3; i++) {
    const uploadedData = await getUploadedData(i);
    if (uploadedData) {
      parsedData = uploadedData;
      break;
    }
  }

  if (!parsedData) {
    const dataFileName = getQueryStringValue("dataFile");
    try {
      const response = await fetch(dataFileName);
      parsedData = await response.json();
    } catch (error) {
      console.info(
        `Failed to load data from ${dataFileName}. Using default values.`,
        error
      );
    }
  }

  jwt = parsedData?.jwt || "";
  projectId = parsedData?.projectId || "";
  apikey = parsedData?.APIKEY || DEFAULT_API_KEY;
  mapId = parsedData?.mapId || DEFAULT_MAP_ID;
  solutionType = parsedData?.solutionType || "ODRD";

  tripLogs = new TripLogs(parsedData?.rawLogs || [], solutionType);
  if (solutionType === "LMFS") {
    taskLogs = new TaskLogs(tripLogs);
  }
}

export {
  loadData,
  tripLogs,
  taskLogs,
  apikey,
  mapId,
  jwt,
  projectId,
  solutionType,
};
