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

/**
 * Recursively sorts the keys of an object or objects within an array,
 * ensuring a consistent order for display and comparison.
 * @param {*} data The object or array to sort.
 * @returns {*} The sorted object or array.
 */
export function sortObjectKeysRecursively(data) {
  const _sort = (obj) => {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(_sort);
    }

    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = _sort(obj[key]);
        return sorted;
      }, {});
  };

  return _sort(data);
}

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
    log("uploadFile: Processing ZIP file.");
    parsedData = await processZipFile(file);
  } else if (file.name.endsWith(".json")) {
    log("uploadFile: Processing JSON file.");
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
        resolve(JSON.parse(event.target.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Error reading JSON file"));
    reader.readAsText(file);
  });
}

export function parseJsonContent(content) {
  const processAndNormalize = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(processAndNormalize);

    return Object.keys(obj).reduce((result, key) => {
      let value = obj[key];

      if (value === null || value === undefined) {
        return result;
      }

      const newKey = key.replace(/_/g, "").toLowerCase();

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
        value = processAndNormalize(value);
        if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
          return result;
        }
      }

      result[newKey] = value;
      return result;
    }, {});
  };

  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const processedData = processAndNormalize(parsed);
    return sortObjectKeysRecursively(processedData);
  } catch (error) {
    if (typeof content !== "string") {
      console.error("JSON processing error on a non-string object:", error);
      throw new Error(`Invalid object content for processing: ${error.message}`);
    }
    log("Initial JSON parsing failed, attempting to wrap in array");
    try {
      const parsed = JSON.parse(`[${content}]`);
      const processedData = processAndNormalize(parsed);
      log("Processed JSON data in array format");
      return sortObjectKeysRecursively(processedData);
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
  let logsArray;
  //Handle if data is not array (like when reading a file).
  if (!Array.isArray(data)) {
    // If it's already in the correct format, return it as is.
    if (data && data.rawLogs && Array.isArray(data.rawLogs)) {
      return {
        ...data,
        APIKEY: data.APIKEY || DEFAULT_API_KEY,
      };
    } else {
      // If it's not an array and not in expected format, throw an error.
      throw new Error("Invalid input data. Expected an array or an object with a rawLogs property.");
    }
  }

  // At this point, we know `data` is an array. We need to determine if it's
  // an array of full log objects or just raw payloads that need to be wrapped.
  if (data.length > 0 && data[0].jsonPayload === undefined && data[0].jsonpayload === undefined) {
    // This is a raw payload array (from a file or extra data source). Wrap them.
    logsArray = data.map((logEntry) => ({ jsonPayload: logEntry, timestamp: logEntry.timestamp }));
  } else {
    // This is already an array of full log objects (either raw or previously normalized).
    logsArray = data;
  }

  const restrictedLogsMap = new Map();
  logsArray.forEach((row) => {
    if (isRestrictedLog(row)) {
      removeEmptyObjects(row.jsonPayload);
      restrictedLogsMap.set(row.jsonPayload.parentInsertId, row);
    }
  });

  if (restrictedLogsMap.size > 0) {
    console.log(`[DEBUG] Found ${restrictedLogsMap.size} TOS-restricted logs to merge.`);
  }

  const mergedLogs = logsArray.filter((row) => {
    if (isRestrictedLog(row)) {
      return false; // Filter out the restricted log itself
    }
    const restrictedLog = restrictedLogsMap.get(row.insertId);
    if (restrictedLog) {
      const restrictedPayload = restrictedLog.jsonPayload;
      ["request", "response"].forEach((section) => {
        if (restrictedPayload[section] && row.jsonPayload[section]) {
          TOS_RESTRICTED_ATTRIBUTES.forEach((attr) => {
            if (restrictedPayload[section][attr] !== undefined) {
              row.jsonPayload[section][attr] = restrictedPayload[section][attr];
            }
            if (restrictedPayload[section].vehicle?.[attr] !== undefined) {
              row.jsonPayload[section].vehicle = row.jsonPayload[section].vehicle || {};
              row.jsonPayload[section].vehicle[attr] = restrictedPayload[section].vehicle[attr];
            }
            if (restrictedPayload[section].trip?.[attr] !== undefined) {
              row.jsonPayload[section].trip = row.jsonPayload[section].trip || {};
              row.jsonPayload[section].trip[attr] = restrictedPayload[section].trip[attr];
            }
          });
        }
      });
    }
    return true;
  });

  // After merging, normalize the entire structure of the final logs.
  const fullyNormalizedLogs = mergedLogs.map((row) => parseJsonContent(row));

  // Determine the solution type based on the presence of _delivery_vehicle logs
  const isLMFS = fullyNormalizedLogs.some((row) => row.logname?.includes("_delivery_vehicle"));
  const solutionType = isLMFS ? "LMFS" : "ODRD";
  console.log(`Determined solution type: ${solutionType}`);

  const bounds = {
    north: -90,
    south: 90,
    east: -180,
    west: 180,
  };
  let hasPoints = false;

  fullyNormalizedLogs.forEach((row) => {
    const lat =
      _.get(row, "jsonpayload.response.lastLocation.rawLocation.latitude") ||
      _.get(row, "jsonpayload.response.lastlocation.rawlocation.latitude");
    const lng =
      _.get(row, "jsonpayload.response.lastLocation.rawLocation.longitude") ||
      _.get(row, "jsonpayload.response.lastlocation.rawlocation.longitude");

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
    rawLogs: fullyNormalizedLogs,
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
