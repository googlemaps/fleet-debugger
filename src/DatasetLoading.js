// src/DatasetLoading.js
import { useState, useEffect } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import ExtraDataSource from "./ExtraDataSource";
import { log } from "./Utils";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { isTokenValid, fetchLogsWithToken, useCloudLoggingLogin, buildQueryFilter } from "./CloudLogging";

const DATA_SOURCES = {
  CLOUD_LOGGING: "cloudLogging",
  EXTRA: "extra",
};

const CloudLoggingFormComponent = ({ onLogsReceived, onFileUpload }) => {
  const getStoredValue = (key, defaultValue = "") => localStorage.getItem(`datasetLoading_${key}`) || defaultValue;

  const [fetching, setFetching] = useState(false);
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
          Trip IDs (comma-separated):
          <input
            type="text"
            name="tripIds"
            value={queryParams.tripIds}
            onChange={(e) => setQueryParams({ ...queryParams, tripIds: e.target.value })}
            className="form-input"
            placeholder="TRIP_ID_1,TRIP_ID_2"
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
        <button type="button" onClick={handleFetch} disabled={fetching} className="primary-button">
          {fetching ? "Fetching..." : isTokenValid() ? "Fetch Logs" : "Sign in and Fetch Logs"}
        </button>
        <label htmlFor="fileUploadInput" className="secondary-button">
          Load JSON or ZIP file instead
        </label>
        <input type="file" id="fileUploadInput" accept=".json,.zip" onChange={onFileUpload} className="file-input" />
      </div>
    </div>
  );
};

export default function DatasetLoading(props) {
  const [activeDataSource, setActiveDataSource] = useState(
    localStorage.getItem("datasetLoading_dataSource") ||
      (ExtraDataSource.isAvailable() ? DATA_SOURCES.EXTRA : DATA_SOURCES.CLOUD_LOGGING)
  );

  useEffect(() => {
    localStorage.setItem("datasetLoading_dataSource", activeDataSource);
  }, [activeDataSource]);

  const isExtra = activeDataSource === DATA_SOURCES.EXTRA;
  const ExtraFormComponent = isExtra ? ExtraDataSource.getFormComponent(props) : null;
  const isExtraAvailable = ExtraDataSource.isAvailable();

  return (
    <>
      <ToastContainer position="top-right" autoClose={5000} />
      <div className="data-source-toggle">
        {isExtraAvailable ? (
          <>
            <button
              onClick={() => setActiveDataSource(DATA_SOURCES.CLOUD_LOGGING)}
              className={!isExtra ? "active" : ""}
            >
              Cloud Logging
            </button>
            <button onClick={() => setActiveDataSource(DATA_SOURCES.EXTRA)} className={isExtra ? "active" : ""}>
              {ExtraDataSource.getDisplayName()}
            </button>
          </>
        ) : (
          <button className="active static">Cloud Logging</button>
        )}
      </div>

      {isExtra ? (
        ExtraFormComponent
      ) : (
        <GoogleOAuthProvider clientId="829183678942-eq2c9cd7pjdm39l2um5thgbrvgva07e7.apps.googleusercontent.com">
          <CloudLoggingFormComponent {...props} />
        </GoogleOAuthProvider>
      )}
    </>
  );
}
