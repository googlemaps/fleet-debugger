/*
 * index.js
 */
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import Map from "./Map";
import rawLogs, { pathCoords } from "./vehicleData";
const logData = {
  pathCoords,
  rawLogs,
};

ReactDOM.render(
  <div>
    <Map logData={logData} />
    <App logData={logData} />
  </div>,
  document.getElementById("root")
);
