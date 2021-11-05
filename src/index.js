/*
 * index.js
 */
import ReactDOM from "react-dom";
import App from "./App";
import Map from "./Map";
import rawLogs, { pathCoords, apikey, jwt, projectId } from "./vehicleData";
const logData = {
  pathCoords,
  rawLogs,
  apikey,
  jwt,
  projectId,
};

ReactDOM.render(
  <div>
    <Map logData={logData} />
    <App logData={logData} />
  </div>,
  document.getElementById("root")
);
