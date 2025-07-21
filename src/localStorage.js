// src/localStorage.js
import JSZip from "jszip";
import { DEFAULT_API_KEY } from "./constants";
import _ from "lodash";
import { log } from "./Utils";

const DB_NAME = "FleetDebuggerDB";
const STORE_NAME = "uploadedData";
const TOS_RESTRICTED_ATTRIBUTES = [
  "currentRouteSegment",
  "waypoints",
  "currentRouteSegmentEndPoint",
  "pickupPoint",
  "intermediateDestinations",
  "dropoffPoint",
  "remainingWaypoints",
  "vehicleWaypoints",
];

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      event.target.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
  });
}

export async function uploadFile(file, index) {
  console.log(`Importing file: ${file.name}`);
  let parsedData;
  if (file.name.endsWith(".zip")) {
    parsedData = await processZipFile(file);
  } else if (file.name.endsWith(".json")) {
    parsedData = await processJsonFile(file);
  } else {
    throw new Error("Unsupported file format. Please upload a ZIP or JSON file.");
  }

  parsedData = ensureCorrectFormat(parsedData);

  await saveToIndexedDB(parsedData, index);
  log("File imported and stored successfully");
}

export async function uploadCloudLogs(logs, index) {
  try {
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.warn("No logs to upload - skipping upload");
      throw new Error("No logs to upload. Please adjust your search criteria and try again.");
    }
    const formattedData = ensureCorrectFormat(logs);
    await saveToIndexedDB(formattedData, index);
    return formattedData;
  } catch (error) {
    console.error("Error processing cloud logs:", error);
    throw error;
  }
}

export async function saveDatasetAsJson(index) {
  try {
    log(`Attempting to save dataset ${index} as JSON`);
    const data = await getUploadedData(index);

    if (!data || !data.rawLogs || !Array.isArray(data.rawLogs) || data.rawLogs.length === 0) {
      throw new Error("No data available to save");
    }

    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });

    // Create a temporary download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Set the filename based on the dataset number and current date
    const date = new Date().toISOString().split("T")[0];
    link.download = `dataset_${index + 1}_${date}.json`;

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    log(`Dataset ${index} saved successfully`);
    return true;
  } catch (error) {
    console.error(`Error saving dataset ${index}:`, error);
    throw error;
  }
}

async function processZipFile(file) {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  const jsonFile = Object.values(contents.files).find((file) => file.name.endsWith(".json"));
  if (!jsonFile) {
    throw new Error("No JSON file found in the ZIP archive");
  }
  const jsonContent = await jsonFile.async("string");
  return processJsonFile(new Blob([jsonContent], { type: "application/json" }));
}

async function processJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsedData = parseJsonContent(content);
        resolve(parsedData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Error reading JSON file"));
    reader.readAsText(file);
  });
}

export function parseJsonContent(content) {
  log("Parsing JSON content");

  const sortObjectKeys = (obj) => {
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
      return obj;
    }

    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortObjectKeys(obj[key]);
        return sorted;
      }, {});
  };

  const processJsonObject = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(processJsonObject);

    return Object.keys(obj).reduce((result, key) => {
      let value = obj[key];

      if (value === null || value === undefined) {
        return result;
      }

      const newKey = key.replace(/_/g, "");

      // Check if this is a value object with only a 'value' property and flatten
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value).length === 1 &&
        "value" in value
      ) {
        value = value.value;

        if (value === null || value === undefined) {
          return result;
        }
      } else if (typeof value === "object" && value !== null) {
        // Recursively process nested objects
        value = processJsonObject(value);

        // Skip empty objects (those with no properties after processing)
        if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
          return result;
        }
      }

      result[newKey] = value;
      return result;
    }, {});
  };

  try {
    const parsed = JSON.parse(content);
    const processedData = processJsonObject(parsed);
    log("Processed JSON data: removed underscores, flattened value objects, and pruned null/undefined fields");
    return sortObjectKeys(processedData);
  } catch (error) {
    log("Initial JSON parsing failed, attempting to wrap in array");
    try {
      const parsed = JSON.parse(`[${content}]`);
      const processedData = processJsonObject(parsed);
      log("Processed JSON data in array format");
      return sortObjectKeys(processedData);
    } catch (innerError) {
      console.error("JSON parsing error:", innerError);
      throw new Error(`Invalid JSON content: ${innerError.message}`);
    }
  }
}

export function removeEmptyObjects(obj) {
  Object.keys(obj).forEach((key) => {
    if (obj[key] && typeof obj[key] === "object") {
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      } else {
        removeEmptyObjects(obj[key]);
      }
    }
  });
  return obj;
}

function isRestrictedLog(row) {
  return row.jsonPayload?.["@type"]?.includes("Restricted") || false;
}

export function ensureCorrectFormat(data) {
  //Handle if data is not array (like when reading a file).
  if (!Array.isArray(data)) {
    // If it's already in the correct format, return it as is.
    if (data && data.rawLogs && Array.isArray(data.rawLogs)) {
      return {
        ...data,
        APIKEY: data.APIKEY || DEFAULT_API_KEY,
      };
    }

    // If it's not an array and not in expected format, throw an error.
    throw new Error("Invalid input data. Expected an array or an object with a rawLogs property.");
  }

  const logsArray = data; // It's already an array of logs.

  const restrictedLogsMap = new Map();
  logsArray.forEach((row) => {
    if (isRestrictedLog(row)) {
      removeEmptyObjects(row.jsonPayload);
      restrictedLogsMap.set(row.jsonPayload.parentInsertId, row);
    }
  });

  // Filter out restricted logs while merging their TOS-restricted attributes into their parent logs.
  const mergedLogs = logsArray.filter((row) => {
    if (isRestrictedLog(row)) {
      return false;
    }
    const restrictedLog = restrictedLogsMap.get(row.insertId)?.jsonPayload;
    if (restrictedLog) {
      ["request", "response"].forEach((section) => {
        if (restrictedLog[section] && row.jsonPayload[section]) {
          TOS_RESTRICTED_ATTRIBUTES.forEach((attr) => {
            if (restrictedLog[section][attr] !== undefined) {
              row.jsonPayload[section][attr] = restrictedLog[section][attr];
            }
            if (restrictedLog[section].vehicle?.[attr] !== undefined) {
              row.jsonPayload[section].vehicle = row.jsonPayload[section].vehicle || {};
              row.jsonPayload[section].vehicle[attr] = restrictedLog[section].vehicle[attr];
            }
            if (restrictedLog[section].trip?.[attr] !== undefined) {
              row.jsonPayload[section].trip = row.jsonPayload[section].trip || {};
              row.jsonPayload[section].trip[attr] = restrictedLog[section].trip[attr];
            }
          });
        }
      });
    }
    return true;
  });

  // Determine the solution type based on the presence of _delivery_vehicle logs
  const isLMFS = mergedLogs.some((row) => row.logName?.includes("_delivery_vehicle"));
  const solutionType = isLMFS ? "LMFS" : "ODRD";
  console.log(`Determined solution type: ${solutionType}`);

  const bounds = {
    north: -90,
    south: 90,
    east: -180,
    west: 180,
  };
  let hasPoints = false;

  mergedLogs.forEach((row) => {
    const lat =
      _.get(row, "jsonPayload.response.lastLocation.rawLocation.latitude") ||
      _.get(row, "jsonPayload.response.lastlocation.rawlocation.latitude");
    const lng =
      _.get(row, "jsonPayload.response.lastLocation.rawLocation.longitude") ||
      _.get(row, "jsonPayload.response.lastlocation.rawlocation.longitude");

    if (lat != null && lng != null) {
      if (!hasPoints) {
        bounds.north = lat;
        bounds.south = lat;
        bounds.east = lng;
        bounds.west = lng;
        hasPoints = true;
      } else {
        bounds.north = Math.max(bounds.north, lat);
        bounds.south = Math.min(bounds.south, lat);
        bounds.east = Math.max(bounds.east, lng);
        bounds.west = Math.min(bounds.west, lng);
      }
    }
  });

  if (!hasPoints) log("Bounds Calculation Failed: Could not find vehicle location data in any row.");

  return {
    APIKEY: DEFAULT_API_KEY,
    vehicle: "",
    projectId: "",
    logSource: "Direct Cloud Logging",
    solutionType: solutionType,
    rawLogs: mergedLogs,
    bounds: hasPoints ? bounds : null,
  };
}

export async function saveToIndexedDB(data, index) {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.put({ id: `uploadedData${index}`, data: data });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getUploadedData(index) {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.get(`uploadedData${index}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ? request.result.data : null);
  });
}

export async function deleteUploadedData(index) {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.delete(`uploadedData${index}`);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
