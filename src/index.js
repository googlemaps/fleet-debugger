/*
 * index.js
 */
import ReactDOM from "react-dom";
import App from "./App";
import Map from "./Map";
import {
  tripLogs,
  loadData,
  apikey,
  mapId,
  jwt,
  projectId,
  solutionType,
} from "./vehicleData";

loadData().then(() => {
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
      <Map logData={logData} />
      <App logData={logData} />
    </div>,
    document.getElementById("root")
  );
});
