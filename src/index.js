/*
 * index.js
 */
import ReactDOM from "react-dom";
import App from "./App";
import ServeHome from "./ServeHome";
import { getQueryStringValue } from "./queryString";
import {
  tripLogs,
  taskLogs,
  loadData,
  apikey,
  mapId,
  jwt,
  projectId,
  solutionType,
} from "./vehicleData";

const params = {
  serveMode: getQueryStringValue("serve"),
};

if (params.serveMode) {
  ReactDOM.render(
    <div>
      <ServeHome />
    </div>,
    document.getElementById("root")
  );
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
      ReactDOM.render(
        <div>
          <App logData={logData} />
        </div>,
        document.getElementById("root")
      );
    })
    .catch((error) => {
      console.error("Failed to load data:", error);
      ReactDOM.render(
        <div>Error loading data. Please check the console for details.</div>,
        document.getElementById("root")
      );
    });
}
