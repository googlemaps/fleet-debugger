// src/localStorage.js

import JSZip from "jszip";
import { DEFAULT_API_KEY } from "./constants";
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
  try {
    return JSON.parse(content);
  } catch (error) {
    log("Initial JSON parsing failed, attempting to wrap in array");
    try {
      return JSON.parse(`[${content}]`);
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
  if (data && Array.isArray(data.rawLogs)) {
    return {
      ...data,
      APIKEY: data.APIKEY || DEFAULT_API_KEY,
    };
  }
  const logsArray = Array.isArray(data) ? data : [data];

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

  return {
    APIKEY: DEFAULT_API_KEY,
    vehicle: "",
    projectId: "",
    logSource: "Direct Cloud Logging",
    solutionType: solutionType,
    rawLogs: mergedLogs,
  };
}

async function saveToIndexedDB(data, index) {
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
