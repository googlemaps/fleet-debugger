// src/CloudLogging.js
import { useGoogleLogin } from "@react-oauth/google";
import { log } from "./Utils";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const MAX_LOGS_LIMIT = 10000;
const PAGE_SIZE = 1000;
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer before actual expiry

export function buildQueryFilter(params) {
  if (!params.projectId?.trim()) {
    throw new Error("Project ID is required");
  }

  // Validate that either vehicleId or tripIds is provided
  if (!params.vehicleId?.trim() && !params.tripIds?.trim()) {
    throw new Error("Either Vehicle ID or at least one Trip ID must be specified");
  }

  // Set default dates if not provided
  const startDate = params.startTime || new Date(0).toISOString();
  const endDate = params.endTime || new Date(Date.now() + 86400000).toISOString();

  // Build vehicle/trip filter part
  let entityFilter = "";
  if (params.vehicleId?.trim()) {
    entityFilter += `labels.vehicle_id="${params.vehicleId.trim()}"`;
  }
  if (params.tripIds?.trim()) {
    const trips = params.tripIds
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (trips.length > 0) {
      const tripFilter = trips.length === 1 ? `labels.trip_id="${trips[0]}"` : `labels.trip_id=~"(${trips.join("|")})"`;
      entityFilter = entityFilter ? `(${entityFilter} OR ${tripFilter})` : tripFilter;
    }
  }

  const filter = `
    resource.type="fleetengine.googleapis.com/Fleet"
    AND ${entityFilter}
    AND timestamp >= "${startDate}"
    AND timestamp <= "${endDate}"
    AND (
      logName:"logs/fleetengine.googleapis.com%2Fcreate_vehicle" OR
      logName:"logs/fleetengine.googleapis.com%2Fupdate_vehicle" OR
      logName:"logs/fleetengine.googleapis.com%2Fcreate_trip" OR
      logName:"logs/fleetengine.googleapis.com%2Fupdate_trip" OR
      logName:"logs/fleetengine.googleapis.com%2Fget_trip"
    )
  `;

  return filter;
}

export const isTokenValid = () => {
  const accessToken = sessionStorage.getItem("cloudLogging_token");
  if (!accessToken) return false;
  const tokenExpiry = parseInt(sessionStorage.getItem("cloudLogging_token_expiry") || "0", 10);
  const now = Date.now();
  return tokenExpiry > now + TOKEN_EXPIRY_BUFFER;
};

export const clearTokenData = () => {
  log("Clearing Cloud Logging token data");
  sessionStorage.removeItem("cloudLogging_token");
  sessionStorage.removeItem("cloudLogging_token_expiry");
};

const fetchLogBatch = async (token, filter, projectId, pageToken = null, retryCount = 0) => {
  log(`Fetching batch with page token: ${pageToken || "Initial request"}`);

  try {
    const response = await fetch("https://logging.googleapis.com/v2/entries:list", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceNames: [`projects/${projectId.trim()}`],
        filter: filter,
        orderBy: "timestamp asc",
        pageSize: PAGE_SIZE,
        ...(pageToken && { pageToken: pageToken }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log("HTTP error details:", errorData);

      if (response.status === 401) {
        clearTokenData();
        throw new Error("Authentication token expired. Please sign in again.");
      }

      throw new Error(
        `HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData.error || errorData)}`
      );
    }
    return response.json();
  } catch (error) {
    if (error.message.includes("Failed to fetch") && retryCount < 2) {
      log(`Network error, retrying (attempt ${retryCount + 1})...`);
      return new Promise((resolve) => {
        setTimeout(
          () => {
            resolve(fetchLogBatch(token, filter, projectId, pageToken, retryCount + 1));
          },
          1000 * (retryCount + 1)
        );
      });
    }
    throw error;
  }
};

export const fetchLogsWithToken = async (token, queryParams, setFetchProgress, onLogsReceived) => {
  const maxResultsParam = parseInt(queryParams.maxResults, 10) || 1000;
  const maxResults = Math.min(maxResultsParam, MAX_LOGS_LIMIT);
  const filter = buildQueryFilter(queryParams);

  let nextPageToken = null;
  let allEntries = [];
  let batchNumber = 1;

  do {
    log(`Fetching batch #${batchNumber}`);
    const data = await fetchLogBatch(token, filter, queryParams.projectId, nextPageToken);
    const entries = data.entries || [];
    nextPageToken = data.nextPageToken;
    log(`Batch #${batchNumber}: Received ${entries.length} logs${nextPageToken ? ", more available" : ""}`);
    allEntries = [...allEntries, ...entries];
    if (setFetchProgress) {
      setFetchProgress({
        current: allEntries.length,
        total: nextPageToken ? allEntries.length + " (more available)" : allEntries.length,
      });
    }
    batchNumber++;

    if (allEntries.length >= maxResults) {
      log(`Reached max results limit of ${maxResults}`);
      if (nextPageToken) {
        toast.info(`Query limited to ${maxResults} logs. There are more logs available that match your criteria.`);
      }
      break;
    }
  } while (nextPageToken);

  if (allEntries.length === 0) {
    toast.warning("No logs found matching your criteria. Please adjust your search parameters.");
    onLogsReceived([]); // Still call the callback with empty array
  } else {
    toast.success(`Successfully retrieved ${allEntries.length} logs`);
    onLogsReceived(allEntries);
  }
};

export const useCloudLoggingLogin = (onSuccess, onError) => {
  return useGoogleLogin({
    onSuccess: (tokenResponse) => {
      log("Google OAuth login successful", tokenResponse);
      const expiryTime = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
      sessionStorage.setItem("cloudLogging_token", tokenResponse.access_token);
      sessionStorage.setItem("cloudLogging_token_expiry", expiryTime.toString());
      if (onSuccess) {
        onSuccess(tokenResponse.access_token);
      }
    },
    onError: (error) => {
      log("Google OAuth login error", error);
      clearTokenData();
      if (onError) {
        onError(error);
      }
    },
    flow: "implicit",
    scope: "https://www.googleapis.com/auth/logging.read https://www.googleapis.com/auth/cloud-platform.read-only",
  });
};
