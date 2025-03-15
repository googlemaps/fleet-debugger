// src/CloudLogging.js
import { useState, useEffect } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { log } from "./Utils";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
      logName:"logs/fleetengine.googleapis.com%2Fupdate_trip"
    )
  `;

  return filter;
}

const CloudLoggingForm = ({ onLogsReceived, onFileUpload }) => {
  const getStoredValue = (key, defaultValue = "") => {
    const stored = localStorage.getItem(`cloudLogging_${key}`);
    return stored ? stored : defaultValue;
  };

  const [accessToken, setAccessToken] = useState(sessionStorage.getItem("cloudLogging_token") || null);
  const [tokenExpiry, setTokenExpiry] = useState(
    parseInt(sessionStorage.getItem("cloudLogging_token_expiry") || "0", 10)
  );
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ total: 0, current: 0 });
  const [queryParams, setQueryParams] = useState({
    projectId: getStoredValue("projectId"),
    vehicleId: getStoredValue("vehicleId"),
    tripIds: getStoredValue("tripIds"),
    startTime: getStoredValue("startTime", ""),
    endTime: getStoredValue("endTime", ""),
    maxResults: getStoredValue("maxResults", "1000"),
  });
  const [error, setLocalError] = useState(null);

  const MAX_LOGS_LIMIT = 10000;
  const PAGE_SIZE = 1000;
  const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes buffer before actual expiry

  // Save params to localStorage when they change
  useEffect(() => {
    Object.entries(queryParams).forEach(([key, value]) => {
      localStorage.setItem(`cloudLogging_${key}`, value);
    });
  }, [queryParams]);

  const isTokenValid = () => {
    if (!accessToken) return false;
    // Check if token is about to expire (with buffer time)
    const now = Date.now();
    return tokenExpiry > now + TOKEN_EXPIRY_BUFFER;
  };

  const clearTokenData = () => {
    log("Clearing token data");
    sessionStorage.removeItem("cloudLogging_token");
    sessionStorage.removeItem("cloudLogging_token_expiry");
    setAccessToken(null);
    setTokenExpiry(0);
  };

  // Use the @react-oauth/google login hook
  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      log("Google OAuth login successful", tokenResponse);

      // Calculate expiry time (tokens usually last 1 hour)
      const expiryTime = Date.now() + (tokenResponse.expires_in || 3600) * 1000;
      setAccessToken(tokenResponse.access_token);
      setTokenExpiry(expiryTime);

      // Store token in session storage
      sessionStorage.setItem("cloudLogging_token", tokenResponse.access_token);
      sessionStorage.setItem("cloudLogging_token_expiry", expiryTime.toString());

      // Automatically fetch logs after successful login if we were in the middle of fetching
      if (fetching) {
        fetchLogsWithToken(tokenResponse.access_token);
      }
    },
    onError: (error) => {
      log("Google OAuth login error", error);
      setLocalError(`Authentication failed: ${error.error || "Unknown error"}`);
      setFetching(false);
      clearTokenData();
    },
    flow: "implicit",
    scope: "https://www.googleapis.com/auth/logging.read https://www.googleapis.com/auth/cloud-platform.read-only",
    onNonOAuthError: (err) => {
      log("Non-OAuth error", err);
      setLocalError(`Non-OAuth error: ${err.type || err.message || "Unknown error"}`);
      setFetching(false);
    },
  });

  const fetchLogBatch = async (token, filter, pageToken = null, retryCount = 0) => {
    log(`Fetching batch with page token: ${pageToken || "Initial request"}`);

    try {
      const response = await fetch("https://logging.googleapis.com/v2/entries:list", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceNames: [`projects/${queryParams.projectId.trim()}`],
          filter: filter,
          orderBy: "timestamp asc",
          pageSize: PAGE_SIZE,
          ...(pageToken && { pageToken: pageToken }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        log("HTTP error details:", errorData);

        // Handle authentication errors specifically
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
      // If there's a network error or other non-HTTP error
      if (error.message.includes("Failed to fetch") && retryCount < 2) {
        log(`Network error, retrying (attempt ${retryCount + 1})...`);
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(fetchLogBatch(token, filter, pageToken, retryCount + 1));
          }, 1000 * (retryCount + 1)); // Exponential backoff
        });
      }
      throw error;
    }
  };

  const fetchLogsWithToken = async (token) => {
    try {
      // Parse maxResults and enforce limits
      const maxResultsParam = parseInt(queryParams.maxResults, 10) || 1000;
      const maxResults = Math.min(maxResultsParam, MAX_LOGS_LIMIT);

      // Validate and build the filter
      const filter = buildQueryFilter(queryParams);

      let nextPageToken = null;
      let allEntries = [];
      let batchNumber = 1;

      do {
        log(`Fetching batch #${batchNumber}`);
        try {
          const data = await fetchLogBatch(token, filter, nextPageToken);
          const entries = data.entries || [];
          nextPageToken = data.nextPageToken;
          log(`Batch #${batchNumber}: Received ${entries.length} logs${nextPageToken ? ", more available" : ""}`);
          allEntries = [...allEntries, ...entries];
          setFetchProgress({
            current: allEntries.length,
            total: nextPageToken ? allEntries.length + " (more available)" : allEntries.length,
          });
          batchNumber++;

          // Break if we've reached the maximum number of logs we want to fetch
          if (allEntries.length >= maxResults) {
            log(`Reached max results limit of ${maxResults}`);
            if (nextPageToken) {
              toast.info(
                `Query limited to ${maxResults} logs. There are more logs available that match your criteria.`
              );
            }
            break;
          }
        } catch (error) {
          if (error.message.includes("401") || error.message.includes("Authentication")) {
            log("Authentication error during fetch, requesting new token");
            googleLogin(); // This will trigger a new login flow
            throw error;
          }

          // If we get an error mid-way through fetching, handle it but retain logs we've already fetched
          console.error(`Error fetching batch #${batchNumber}:`, error);
          if (allEntries.length > 0) {
            // We have some logs already, so show a warning but continue
            toast.warning(
              `Error fetching more logs: ${error.message}. Showing ${allEntries.length} logs retrieved so far.`
            );
            break;
          } else {
            // No logs fetched yet, so raise the error
            throw error;
          }
        }
      } while (nextPageToken);

      if (allEntries.length === 0) {
        toast.warning("No logs found matching your criteria. Please adjust your search parameters.");
      } else {
        toast.success(`Successfully retrieved ${allEntries.length} logs`);
        onLogsReceived(allEntries);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      setLocalError(`Error: ${error.message}`);
      if (error.message.includes("401") || error.message.includes("Authentication")) {
        toast.error("Authentication error. Please complete the sign-in process to continue.");
      }
    } finally {
      setFetching(false);
    }
  };

  const handleFetch = async () => {
    log("Fetching logs with pagination support");
    setLocalError(null);
    setFetching(true);
    setFetchProgress({ current: 0, total: 0 });

    try {
      if (isTokenValid()) {
        log("Using existing valid token");
        await fetchLogsWithToken(accessToken);
      } else {
        log("No valid token, initiating OAuth login");
        googleLogin();
      }
    } catch (error) {
      console.error("Failed to initiate fetch:", error);
      setLocalError(`Failed to fetch logs: ${error.message}`);
      setFetching(false);
    }
  };

  return (
    <div className="cloud-logging-form">
      <ToastContainer position="top-right" autoClose={5000} />
      <h3>Fleet Engine Logs Loading</h3>
      <form action="#" method="get" onSubmit={(e) => e.preventDefault()}>
        <div className="form-field">
          <label className="form-label">
            Project ID: <span style={{ color: "red" }}>*</span>
            <input
              type="text"
              name="projectId"
              value={queryParams.projectId}
              onChange={(e) => setQueryParams({ ...queryParams, projectId: e.target.value })}
              className="form-input"
              autoComplete="on"
            />
          </label>
        </div>
        <div className="form-field">
          <label className="form-label">
            Vehicle ID:
            <input
              type="text"
              name="vehicleId"
              value={queryParams.vehicleId}
              onChange={(e) => setQueryParams({ ...queryParams, vehicleId: e.target.value })}
              className="form-input"
              autoComplete="on"
            />
          </label>
        </div>
        <div className="form-field">
          <label className="form-label">
            Trip IDs (comma-separated):
            <input
              type="text"
              name="tripIds"
              value={queryParams.tripIds}
              onChange={(e) => setQueryParams({ ...queryParams, tripIds: e.target.value })}
              className="form-input"
              placeholder="TRIP_ID_1,TRIP_ID_2,TRIP_ID_3"
              autoComplete="on"
            />
          </label>
          <small className="form-help-text">Either Vehicle ID or Trip IDs must be specified</small>
        </div>
        <div className="form-field">
          <label className="form-label">
            Start Time (optional):
            <input
              type="datetime-local"
              name="startTime"
              value={queryParams.startTime}
              onChange={(e) => setQueryParams({ ...queryParams, startTime: e.target.value })}
              className="form-input"
            />
          </label>
        </div>
        <div className="form-field">
          <label className="form-label">
            End Time (optional):
            <input
              type="datetime-local"
              name="endTime"
              value={queryParams.endTime}
              onChange={(e) => setQueryParams({ ...queryParams, endTime: e.target.value })}
              className="form-input"
            />
          </label>
          <small className="form-help-text">If not specified, all logs until now will be included</small>
        </div>
        <div className="form-field">
          <label className="form-label">
            Max Results (1-10,000):
            <input
              type="number"
              name="maxResults"
              min="1"
              max={MAX_LOGS_LIMIT}
              value={queryParams.maxResults}
              onChange={(e) => setQueryParams({ ...queryParams, maxResults: e.target.value })}
              className="form-input"
            />
          </label>
          <small className="form-help-text">Maximum number of logs to fetch (default: 1000, max: 10,000)</small>
        </div>
        {error && <div className="error-message">{error}</div>}
        {fetching && (
          <div className="progress-indicator">
            <div>
              Fetching logs: {fetchProgress.current}{" "}
              {fetchProgress.total !== fetchProgress.current && `of ${fetchProgress.total}`}
            </div>
            <progress value={fetchProgress.current} max={fetchProgress.total || 100} className="progress-bar" />
          </div>
        )}
        <div className="cloud-logging-buttons">
          <button
            type="button"
            onClick={handleFetch}
            disabled={fetching}
            className="cloud-logging-fetch-button primary-button"
          >
            {fetching ? "Fetching logs..." : isTokenValid() ? "Fetch Logs" : "Sign in and Fetch Logs"}
          </button>
          <label htmlFor="fileUploadInput" className="cloud-logging-file-button secondary-button">
            Load JSON or ZIP file instead
          </label>
          <input type="file" id="fileUploadInput" accept=".json,.zip" onChange={onFileUpload} className="file-input" />
        </div>
      </form>
      {accessToken && (
        <div className={`auth-status ${isTokenValid() ? "auth-status-valid" : "auth-status-invalid"}`}>
          {isTokenValid()
            ? `Token valid until: ${new Date(tokenExpiry).toLocaleString()}`
            : "Token expired or invalid. Will re-authenticate automatically."}
        </div>
      )}
    </div>
  );
};

export default function CloudLogging(props) {
  return (
    <GoogleOAuthProvider clientId="829183678942-eq2c9cd7pjdm39l2um5thgbrvgva07e7.apps.googleusercontent.com">
      <CloudLoggingForm {...props} />
    </GoogleOAuthProvider>
  );
}
