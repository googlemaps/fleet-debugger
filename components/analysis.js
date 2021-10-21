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

const _ = require('lodash');

/**
 * Compute simplied update vehicle logs
 *
 * TODO --  why process this here?  Consider including
 * full log within the output file (or at at least 
 * a simplified version with same schema).  Otherwise
 * adding additional datasources is going to be a headache
 */
function updateVehicleData(entry) {
   const response = entry.jsonPayload.response;
   return {
      logName: entry.logName,
      rawLocation: response.lastLocation.rawLocation,
      rawLocationAccuracy: response.lastLocation.rawLocationAccuracy,
      navStatus: response.navStatus,
      state: response.state,
      labels: entry.labels,
   }
}

/**
 * Generate vehicle paths suitable for rendering in the browser.
 * TODO: remove this now unnecessary preprocessing and rely directly 
 * on updateVehicleLogs in the client
 */
function computePath(jsonData) {
   if (jsonData.updateVehicleLogs) {
      return _.map(jsonData.updateVehicleLogs, e => {
         return {
            lat:e.rawLocation.latitude,
            lng:e.rawLocation.longitude,
            trip_id: e.labels.trip_id,
         }
      });
   }
}

/**
 * Extract simplied log entries for use in visualization
 */
function processLogs(entries) {
   const jsonData = {};
   jsonData.updateVehicleLogs =_(entries).
      // TODO: errors (like deadline exceeded) won't have a response field.  should still show them somehow
      // TODO: export full logs into js
      // TODO: shouldn't ignore entries with missing lastLocation
      filter(x => x.logName.endsWith('update_vehicle') && x.jsonPayload.response && x.jsonPayload.response.lastLocation).
      map(updateVehicleData).
      value();
   jsonData.pathCoordinates = computePath(jsonData);
   return jsonData;
}

exports.processLogs = processLogs;
