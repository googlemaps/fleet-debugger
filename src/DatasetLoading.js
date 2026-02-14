// src/DatasetLoading.js
import { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import ExtraDataSource from "./ExtraDataSource";
import { log } from "./Utils";
import { toast } from "react-toastify";
import { isTokenValid, fetchLogsWithToken, useCloudLoggingLogin, buildQueryFilter } from "./CloudLogging";
import { useSheetsLogin, isSheetsTokenValid, getSheetsToken, importFromGoogleSheet } from "./GoogleSheets";
import { HAS_EXTRA_DATA_SOURCE, GOOGLE_CLIENT_ID } from "./constants";

const CloudLoggingFormComponent = ({ onLogsReceived, onFileUpload }) => {
  const getStoredValue = (key, defaultValue = "") => localStorage.getItem(`datasetLoading_${key}`) || defaultValue;

  const [fetching, setFetching] = useState(false);
  const [sheetFormVisible, setSheetFormVisible] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem("datasetLoading_sheetUrl") || "");
  const [sheetLoading, setSheetLoading] = useState(false);
  const [queryParams, setQueryParams] = useState({
    projectId: getStoredValue("projectId"),
    vehicleId: getStoredValue("vehicleId"),
    tripIds: getStoredValue("tripIds"),
    startTime: getStoredValue("startTime"),
    endTime: getStoredValue("endTime"),
    maxResults: getStoredValue("maxResults", "1000"),
  });
  const [error, setLocalError] = useState(null);

  const handleCloudLoggingFetch = (token) => {
    log("handleCloudLoggingFetch called with token.");
    fetchLogsWithToken(token, queryParams, null, onLogsReceived)
      .catch((err) => {
        setLocalError(`Error: ${err.message}`);
        toast.error(`Error: ${err.message}`);
      })
      .finally(() => setFetching(false));
  };

  const googleLogin = useCloudLoggingLogin(
    (token) => {
      log("Cloud Logging login successful, now fetching logs.");
      handleCloudLoggingFetch(token);
    },
    (err) => {
      log("Cloud Logging login failed.", err);
      setLocalError(`Auth Error: ${err.error || "Unknown"}`);
      setFetching(false);
    }
  );

  const handleFetch = () => {
    log("Cloud Logging handleFetch clicked");
    setLocalError(null);
    setFetching(true);
    try {
      Object.entries(queryParams).forEach(([key, value]) => {
        localStorage.setItem(`datasetLoading_${key}`, value);
      });

      buildQueryFilter(queryParams); // Quick validation
      if (isTokenValid()) {
        handleCloudLoggingFetch(sessionStorage.getItem("cloudLogging_token"));
      } else {
        log("No valid Cloud Logging token, initiating login.");
        googleLogin();
      }
    } catch (err) {
      setLocalError(err.message);
      setFetching(false);
    }
  };

  const handleSheetImport = (token) => {
    setSheetLoading(true);
    setLocalError(null);
    localStorage.setItem("datasetLoading_sheetUrl", sheetUrl);

    importFromGoogleSheet(sheetUrl, token)
      .then((logs) => {
        log(`Received ${logs.length} logs from Google Sheet`);
        if (logs.length > 0) {
          onLogsReceived(logs);
        } else {
          toast.warning("No logs found in the spreadsheet.");
        }
      })
      .catch((err) => {
        setLocalError(`Sheet import error: ${err.message}`);
        toast.error(`Sheet import error: ${err.message}`);
      })
      .finally(() => setSheetLoading(false));
  };

  const sheetsLogin = useSheetsLogin(
    (token) => {
      log("Sheets login successful, importing...");
      handleSheetImport(token);
    },
    (err) => {
      log("Sheets login failed.", err);
      setLocalError(`Auth Error: ${err.error || "Unknown"}`);
      setSheetLoading(false);
    }
  );

  const handleSheetLoadClick = () => {
    if (!sheetUrl.trim()) {
      setLocalError("Please enter a spreadsheet URL or ID.");
      return;
    }
    setLocalError(null);
    if (isSheetsTokenValid()) {
      handleSheetImport(getSheetsToken());
    } else {
      sheetsLogin();
    }
  };

  return (
    <div className="cloud-logging-form">
      <h3>Fleet Engine Logs Loading</h3>
      <div className="form-fields-wrapper">
        <div className="form-field">
          <label className="form-label">
            Project ID: <span style={{ color: "red" }}>*</span>
            <input
              type="text"
              name="projectId"
              value={queryParams.projectId}
              placeholder="geod-support-gems"
              onChange={(e) => setQueryParams({ ...queryParams, projectId: e.target.value })}
              className="form-input"
              autoComplete="on"
            />
          </label>
        </div>
      </div>
      {/* Shared Fields */}
      <div className="form-field">
        <label className="form-label">
          Vehicle ID:
          <input
            type="text"
            name="vehicleId"
            value={queryParams.vehicleId}
            placeholder="Vehicle_1"
            onChange={(e) => setQueryParams({ ...queryParams, vehicleId: e.target.value })}
            className="form-input"
            autoComplete="on"
          />
        </label>
      </div>
      <div className="form-field">
        <label className="form-label">
          Trip/Task IDs (comma-separated):
          <input
            type="text"
            name="tripIds"
            value={queryParams.tripIds}
            onChange={(e) => setQueryParams({ ...queryParams, tripIds: e.target.value })}
            className="form-input"
            placeholder="TRIP_ID, TASK_ID"
            autoComplete="on"
          />
        </label>
      </div>
      <div className="form-field">
        <label className="form-label">
          Start Time (optional):
          <input
            type="text"
            name="startTime UTC"
            placeholder="2025-09-07T22:13:00"
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
            type="text"
            name="endTime UTC"
            placeholder="2025-09-08T22:13:00"
            value={queryParams.endTime}
            onChange={(e) => setQueryParams({ ...queryParams, endTime: e.target.value })}
            className="form-input"
          />
        </label>
      </div>
      <div className="form-field">
        <label className="form-label">
          Max Results:
          <input
            type="number"
            name="maxResults"
            min="1"
            max="10000"
            value={queryParams.maxResults}
            onChange={(e) => setQueryParams({ ...queryParams, maxResults: e.target.value })}
            className="form-input"
          />
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}
      {fetching && (
        <div className="progress-indicator">
          <div>Fetching logs...</div>
          <progress className="progress-bar" />
        </div>
      )}
      <div className="cloud-logging-buttons">
        <button type="button" onClick={handleFetch} disabled={fetching} className="fetch-logs-button">
          {fetching ? "Fetching..." : isTokenValid() ? "Fetch Logs" : "Sign in and Fetch Logs"}
        </button>
        <button type="button" onClick={() => setSheetFormVisible(!sheetFormVisible)} className="sideload-logs-button">
          Load Google Sheet
        </button>
        <label htmlFor="fileUploadInput" className="sideload-logs-button">
          Load JSON or ZIP
        </label>
        <input type="file" id="fileUploadInput" accept=".json,.zip" onChange={onFileUpload} className="file-input" />
      </div>
      {sheetFormVisible && (
        <div className="google-sheet-form">
          <div className="form-field">
            <label className="form-label">
              Spreadsheet URL or ID:
              <input
                type="text"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... or spreadsheet ID"
                className="form-input"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleSheetLoadClick}
            disabled={sheetLoading}
            className="fetch-logs-button"
            style={{ marginTop: "8px" }}
          >
            {sheetLoading ? "Loading..." : isSheetsTokenValid() ? "Load Sheet" : "Sign in and Load Sheet"}
          </button>
          {sheetLoading && (
            <div className="progress-indicator">
              <div>Loading from Google Sheet...</div>
              <progress className="progress-bar" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function DatasetLoading(props) {
  const [activeDataSource, setActiveDataSource] = useState(
    localStorage.getItem("lastUsedDataSource") || (HAS_EXTRA_DATA_SOURCE ? "extra" : "cloudLogging")
  );

  useEffect(() => {
    localStorage.setItem("lastUsedDataSource", activeDataSource);
  }, [activeDataSource]);

  const isExtra = activeDataSource === "extra";
  const ExtraFormComponent = isExtra ? ExtraDataSource.getFormComponent(props) : null;

  const renderSourceSelection = () => {
    if (!HAS_EXTRA_DATA_SOURCE) {
      return <button className="active static">Cloud Logging</button>;
    }

    return (
      <>
        <button onClick={() => setActiveDataSource("cloudLogging")} className={!isExtra ? "active" : ""}>
          Cloud Logging
        </button>
        <button onClick={() => setActiveDataSource("extra")} className={isExtra ? "active" : ""}>
          {ExtraDataSource.getDisplayName()}
        </button>
      </>
    );
  };

  return (
    <>
      <div className="data-source-toggle">{renderSourceSelection()}</div>

      {isExtra ? (
        ExtraFormComponent
      ) : (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <CloudLoggingFormComponent {...props} />
        </GoogleOAuthProvider>
      )}
    </>
  );
}
