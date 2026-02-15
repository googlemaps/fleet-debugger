// src/DatasetSideLoading.js
import { useState } from "react";
import { toast } from "react-toastify";
import { useSheetsLogin, isSheetsTokenValid, getSheetsToken, importFromGoogleSheet } from "./GoogleSheets";
import { log } from "./Utils";

/**
 * A shared section for sidebar/sideloading logs (Google Sheets and local files).
 * This handles the "Load Google Sheet" and "Load JSON or ZIP" buttons and forms.
 *
 * @param {Object} props
 * @param {Function} props.onLogsReceived Callback when logs are received (from Sheet).
 * @param {Function} props.onFileUpload Callback for file uploads.
 * @param {Function} props.setLocalError Callback to set error messages in the parent.
 * @param {React.ReactNode} props.children The primary fetch button(s) to show alongside sideload buttons.
 */
export const DatasetSideLoading = ({ onLogsReceived, onFileUpload, setLocalError, children }) => {
  const [sheetFormVisible, setSheetFormVisible] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem("datasetLoading_sheetUrl") || "");
  const [sheetLoading, setSheetLoading] = useState(false);

  const handleSheetImport = (token) => {
    setSheetLoading(true);
    if (setLocalError) setLocalError(null);
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
        if (setLocalError) setLocalError(`Sheet import error: ${err.message}`);
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
      if (setLocalError) setLocalError(`Auth Error: ${err.error || "Unknown"}`);
      setSheetLoading(false);
    }
  );

  const handleSheetLoadClick = () => {
    if (!sheetUrl.trim()) {
      if (setLocalError) setLocalError("Please enter a spreadsheet URL or ID.");
      return;
    }
    if (setLocalError) setLocalError(null);
    if (isSheetsTokenValid()) {
      handleSheetImport(getSheetsToken());
    } else {
      sheetsLogin();
    }
  };

  return (
    <>
      <div className="cloud-logging-buttons">
        {children}
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
    </>
  );
};

export default DatasetSideLoading;
