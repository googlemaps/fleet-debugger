// localStorage.js

import JSZip from "jszip";
import { DEFAULT_API_KEY } from "./constants";

const DB_NAME = "FleetDebuggerDB";
const STORE_NAME = "uploadedData";

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
  console.log(`Uploading file: ${file.name}`);
  let parsedData;
  if (file.name.endsWith(".zip")) {
    parsedData = await processZipFile(file);
  } else if (file.name.endsWith(".json")) {
    parsedData = await processJsonFile(file);
  } else {
    throw new Error(
      "Unsupported file format. Please upload a ZIP or JSON file."
    );
  }

  parsedData = ensureCorrectFormat(parsedData);

  await saveToIndexedDB(parsedData, index);
  console.log("File uploaded and saved successfully");
}

async function processZipFile(file) {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  const jsonFile = Object.values(contents.files).find((file) =>
    file.name.endsWith(".json")
  );
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

function parseJsonContent(content) {
  console.log("Parsing JSON content");
  try {
    return JSON.parse(content);
  } catch (error) {
    console.log("Initial JSON parsing failed, attempting to wrap in array");
    try {
      return JSON.parse(`[${content}]`);
    } catch (innerError) {
      console.error("JSON parsing error:", innerError);
      throw new Error(`Invalid JSON content: ${innerError.message}`);
    }
  }
}

function ensureCorrectFormat(data) {
  if (data && Array.isArray(data.rawLogs)) {
    return {
      ...data,
      APIKEY: data.APIKEY || DEFAULT_API_KEY,
    };
  } else {
    const logsArray = Array.isArray(data) ? data : [data];

    // Determine the solution type based on the resource type of the first log entry
    const firstLog = logsArray[0];
    const resourceType = firstLog?.resource?.type;
    let solutionType;

    if (resourceType === "fleetengine.googleapis.com/DeliveryFleet") {
      solutionType = "LMFS";
    } else if (resourceType === "fleetengine.googleapis.com/Fleet") {
      solutionType = "ODRD";
    } else {
      console.warn(
        `Unknown resource type: ${resourceType}, defaulting to ODRD`
      );
      solutionType = "ODRD";
    }

    console.log(`Determined solution type: ${solutionType}`);

    return {
      APIKEY: DEFAULT_API_KEY,
      vehicle: "",
      projectId: "",
      logSource: "Direct Cloud Logging",
      solutionType: solutionType,
      rawLogs: logsArray,
    };
  }
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
    request.onsuccess = () =>
      resolve(request.result ? request.result.data : null);
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
