/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
//const {Logging} = require('@google-cloud/logging');
const { google } = require("googleapis");
const logging = google.logging("v2");
const auth = require("./auth.js");
const _ = require("lodash");
const fs = require("fs");

/*
 * For now, the get_trip/get_task logs are too noisy and don't have any visualization
 * integrations.
 */
const interestingLogs = [
  // ODRD
  "create_vehicle",
  "update_vehicle",
  "get_vehicle",
  "create_trip",
  "update_trip",
  // LMFS
  "create_task",
  "update_task",
  "create_delivery_vehicle",
  "update_delivery_vehicle",
];

/**
 * Uses cloud logging APIs to list log entries from the
 * fleet engine resource matching the specified label.
 */
async function fetchLogs(label, labelValues, daysAgo = 2, extra = "") {
  const endPoint = "fleetengine.googleapis.com";
  const resourceName = "projects/" + auth.getProjectId();
  // TODO better handling of date range for search: allow start/end
  let startDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);
  const logFilterString = _.map(
    interestingLogs,
    (logName) => `${resourceName}/logs/${endPoint}%2F${logName}`
  ).join(" OR ");
  const labelFilterString = labelValues.join(" OR ");
  const filterString = `resource.type=fleetengine.googleapis.com/Fleet labels.${label}=(${labelFilterString}) timestamp>="${startDate.toISOString()}" ${extra} log_name=(${logFilterString})`;
  console.log("log filter", filterString);
  let entries = [];
  try {
    const request = {
      resourceNames: [resourceName],
      filter: filterString,
      auth: auth.getAuthClient(),
      pageSize: 500,
      order_by: "timestamp desc",
    };
    let logs;
    do {
      if (logs && logs.data.nextPageToken) {
        request.pageToken = logs.data.nextPageToken;
      }
      logs = await logging.entries.list(request);
      if (logs.data.entries) {
        entries = _.concat(entries, logs.data.entries);
      }
    } while (logs.data.nextPageToken);
  } catch (e) {
    console.log("failed to list logs", e);
  }
  // Remove get_trip calls -- there's too many of them
  return _.filter(entries, (le) => !le.logName.endsWith("get_trip"));
}

/**
 * Generates & writes a valid javascript to specified file.  Existing file at location
 * will be overwritten.
 */
function writeLogs(filePath, data) {
  const fileStr = `
// Generated File.  Do not edit/submit
const appData = '${JSON.stringify(data)}';
const parsedData = JSON.parse(appData);
// Universal module.  See https://github.com/umdjs/umd
(function (root, factory) {
    /* eslint-disable no-undef */
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.returnExports = factory();
  }
}(typeof self !== 'undefined' ? self : this, () => {

    // Just return a value to define the module export.
    // This example returns an object, but the module
    // can return a function as the exported value.
    return {parsedData};
}));`;
  fs.writeFileSync(filePath, fileStr);
}

exports.fetchLogs = fetchLogs;
exports.writeLogs = writeLogs;
