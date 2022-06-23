/*
 * index.js
 */
import ReactDOM from "react-dom";
import App from "./App";
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
      <App logData={logData} />
    </div>,
    document.getElementById("root")
  );
});
