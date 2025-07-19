// src/index.js
import { createRoot } from "react-dom/client";
import App from "./App";
import ServeHome from "./ServeHome";
import { getQueryStringValue } from "./queryString";
import { tripLogs, taskLogs, loadData, apikey, mapId, jwt, projectId, solutionType } from "./vehicleData";

console.log(`
  Detailed console logging is disabled by default.
  To modify logging behavior, use these commands in the javascript console:
  
  debug.enable()  // Enable detailed console logging
  debug.disable() // Disable detailed console logging
  debug.status()  // Check current logging status
  `);

const params = {
  serveMode: getQueryStringValue("serve"),
};

const container = document.getElementById("root");
const root = createRoot(container);

if (params.serveMode) {
  root.render(<ServeHome />);
} else {
  loadData(params)
    .then(() => {
      const logData = {
        tripLogs,
        taskLogs,
        apikey,
        mapId,
        jwt,
        projectId,
        solutionType,
      };
      console.log("Data loaded, rendering main App.");
      root.render(<App logData={logData} />);
    })
    .catch((error) => {
      console.error("Failed to load data:", error);
      root.render("Error loading data. Please check the console for details.");
    });
}
