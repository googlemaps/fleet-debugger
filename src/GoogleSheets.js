// src/GoogleSheets.js
import { useGoogleLogin } from "@react-oauth/google";
import { getUploadedData, getVehicleIdFromLogs } from "./localStorage";
import { log } from "./Utils";
import _ from "lodash";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const CLIENT_ID = "829183678942-eq2c9cd7pjdm39l2um5thgbrvgva07e7.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

const API_TYPE_REGEX_MAP = [
  { name: "createVehicle", regex: /createVehicle/i },
  { name: "getVehicle", regex: /getVehicle/i },
  { name: "updateVehicle", regex: /updateVehicle/i },
  { name: "createDeliveryVehicle", regex: /createDeliveryVehicle/i },
  { name: "getDeliveryVehicle", regex: /getDeliveryVehicle/i },
  { name: "updateDeliveryVehicle", regex: /updateDeliveryVehicle/i },
  { name: "createTrip", regex: /createTrip/i },
  { name: "getTrip", regex: /getTrip/i },
  { name: "updateTrip", regex: /updateTrip/i },
  { name: "createTask", regex: /createTask/i },
  { name: "getTask", regex: /getTask/i },
  { name: "updateTask", regex: /updateTask/i },
];

function getApiType(logEntry) {
  const typeField = logEntry["@type"] || logEntry.jsonpayload?.["@type"] || "";
  for (const { name, regex } of API_TYPE_REGEX_MAP) {
    if (regex.test(typeField)) return name;
  }
  return "other";
}

// --- Token Management ---

export const isSheetsTokenValid = () => {
  const token = sessionStorage.getItem("sheets_token");
  if (!token) return false;
  const expiry = parseInt(sessionStorage.getItem("sheets_token_expiry") || "0", 10);
  return expiry > Date.now() + TOKEN_EXPIRY_BUFFER;
};

export const getSheetsToken = () => sessionStorage.getItem("sheets_token");

const storeSheetsToken = (accessToken, expiresIn) => {
  const expiryTime = Date.now() + (expiresIn || 3600) * 1000;
  sessionStorage.setItem("sheets_token", accessToken);
  sessionStorage.setItem("sheets_token_expiry", expiryTime.toString());
};

/**
 * Acquires an OAuth token for Google Sheets using the GIS token client.
 * Works outside of React context / GoogleOAuthProvider.
 */
export function requestSheetsToken() {
  return new Promise((resolve, reject) => {
    if (isSheetsTokenValid()) {
      resolve(getSheetsToken());
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services not loaded. Please refresh and try again."));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(`Auth error: ${tokenResponse.error}`));
          return;
        }
        storeSheetsToken(tokenResponse.access_token, tokenResponse.expires_in);
        resolve(tokenResponse.access_token);
      },
      error_callback: (error) => {
        reject(new Error(`Auth error: ${error.message || "Unknown"}`));
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Hook for use inside GoogleOAuthProvider (DatasetLoading dialog).
 */
export const useSheetsLogin = (onSuccess, onError) => {
  return useGoogleLogin({
    onSuccess: (tokenResponse) => {
      log("Google Sheets OAuth login successful");
      storeSheetsToken(tokenResponse.access_token, tokenResponse.expires_in);
      if (onSuccess) onSuccess(tokenResponse.access_token);
    },
    onError: (error) => {
      log("Google Sheets OAuth login error", error);
      if (onError) onError(error);
    },
    flow: "implicit",
    scope: SCOPES,
  });
};

// --- Flatten / Unflatten ---

const reversePath = (path) => path.split(".").reverse().join(".");

function flattenObject(obj, prefix = "") {
  const result = {};
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullPath));
    } else {
      result[fullPath] = value;
    }
  }
  return result;
}

function collectAllKeys(logs) {
  const keysSet = new Set();
  for (const entry of logs) {
    const flat = flattenObject(entry);
    for (const key of Object.keys(flat)) {
      keysSet.add(key);
    }
  }
  const keys = Array.from(keysSet);
  keys.sort();
  const tsIndex = keys.indexOf("timestamp");
  if (tsIndex > 0) {
    keys.splice(tsIndex, 1);
    keys.unshift("timestamp");
  }
  return keys;
}

function toCellValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function fromCellValue(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    if (value.startsWith("[") || value.startsWith("{")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") return num;
  }
  return value;
}

// --- Sheets API Helpers ---

async function sheetsApiFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Sheets API error (${response.status}): ${errorData.error?.message || JSON.stringify(errorData)}`);
  }
  return response.json();
}

// --- Export ---

export async function exportToGoogleSheet(index, token) {
  log(`Exporting dataset ${index} to Google Sheet`);
  const data = await getUploadedData(index);

  if (!data?.rawLogs?.length) {
    throw new Error("No data available to export");
  }

  const grouped = {};
  for (const entry of data.rawLogs) {
    const apiType = getApiType(entry);
    if (!grouped[apiType]) grouped[apiType] = [];
    grouped[apiType].push(entry);
  }

  const sheetNames = Object.keys(grouped).sort();
  log(`Grouped logs into ${sheetNames.length} API types: ${sheetNames.join(", ")}`);

  const sheets = sheetNames.map((name) => ({ properties: { title: name } }));

  const vehicleId = getVehicleIdFromLogs(data.rawLogs);
  const date = new Date().toISOString().split("T")[0];
  const spreadsheet = await sheetsApiFetch(SHEETS_API_BASE, token, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Fleet Debugger - ${vehicleId} - ${date}` },
      sheets,
    }),
  });

  const spreadsheetId = spreadsheet.spreadsheetId;
  log(`Created spreadsheet: ${spreadsheetId}`);

  const valueRanges = [];
  for (const sheetName of sheetNames) {
    const logs = grouped[sheetName];
    const originalHeaders = collectAllKeys(logs);
    const displayHeaders = originalHeaders.map(reversePath);
    const rows = [displayHeaders];

    for (const entry of logs) {
      const flat = flattenObject(entry);
      const row = originalHeaders.map((h) => toCellValue(flat[h]));
      rows.push(row);
    }

    valueRanges.push({
      range: `'${sheetName}'!A1`,
      values: rows,
    });
  }

  await sheetsApiFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: valueRanges,
    }),
  });

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  log(`Export complete: ${sheetUrl}`);
  return sheetUrl;
}

// --- Import ---

function extractSpreadsheetId(input) {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed;
  throw new Error("Invalid spreadsheet URL or ID");
}

export async function importFromGoogleSheet(spreadsheetInput, token) {
  const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
  log(`Importing from spreadsheet: ${spreadsheetId}`);

  const metadata = await sheetsApiFetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties.title`, token);

  const sheetNames = metadata.sheets.map((s) => s.properties.title);
  log(`Found ${sheetNames.length} tabs: ${sheetNames.join(", ")}`);

  const ranges = sheetNames.map((name) => `'${name}'!A:ZZ`);
  const batchResult = await sheetsApiFetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&")}`,
    token
  );

  const allLogs = [];
  for (const valueRange of batchResult.valueRanges) {
    const rows = valueRange.values;
    if (!rows || rows.length < 2) continue;

    const displayHeaders = rows[0];
    const originalHeaders = displayHeaders.map(reversePath);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const obj = {};
      for (let j = 0; j < originalHeaders.length; j++) {
        const value = fromCellValue(j < row.length ? row[j] : undefined);
        if (value !== undefined) {
          _.set(obj, originalHeaders[j], value);
        }
      }
      allLogs.push(obj);
    }
  }

  log(`Imported ${allLogs.length} total log entries`);

  if (allLogs.length === 0) {
    throw new Error("No log data found in the spreadsheet");
  }

  allLogs.sort((a, b) => {
    const tsA = a.timestamp || "";
    const tsB = b.timestamp || "";
    return tsA < tsB ? -1 : tsA > tsB ? 1 : 0;
  });

  return allLogs;
}
