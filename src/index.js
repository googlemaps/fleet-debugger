/*
 * index.js
 */
import ReactDOM from "react-dom";
import App from "./App";
import Map from "./Map";
import { tripLogs, apikey, jwt, projectId, solutionType } from "./vehicleData";

const logData = {
  tripLogs,
  apikey,
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
