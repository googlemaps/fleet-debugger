/*
 * index.js
 */
import ReactDOM from "react-dom";
import App from "./App";
import ServeHome from "./ServeHome";
import { getQueryStringValue } from "./queryString";
import {
  tripLogs,
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
  loadData(params).then(() => {
    const logData = {
      tripLogs,
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
  });
}
