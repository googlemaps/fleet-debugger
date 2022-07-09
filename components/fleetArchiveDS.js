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

const { Datasource } = require("./datasource.js");
const _ = require("lodash");
const auth = require("./auth.js");
const axios = require("axios");

class FleetArchiveLogs extends Datasource {
  constructor(argv) {
    super(argv);
    this.startTimeSeconds = Math.round(new Date(argv.startTime).getTime() / 1000);
    this.endTimeSeconds = Math.round(new Date(argv.endTime).getTime() / 1000);
  }
  async fetchTripLogsForVehicle(vehicle_id, vehicleLogs) {
    if (!vehicle_id) {
      return [];
    }
    console.log("Loading trip logs for vehicle id", vehicle_id);
    // console.log(vehicleLogs);
    let tripLogs = [];
    return tripLogs;
  }

  async fetchTaskLogsForVehicle(vehicle_id, vehicleLogs) {
    if (!vehicle_id) {
      return [];
    }
    console.log("Loading tasks logs for deliveryVehicle id", vehicle_id);
    // console.log(vehicleLogs);
    let taskLogs = [];
    return taskLogs;
  }

  async fetchVehicleLogs(vehicle, trip) {
    const label = vehicle ? "vehicle_id" : "trip_id";
    const labelVal = vehicle ? vehicle : trip;

    console.log(`Fetching logs for ${label} = ${labelVal} from Fleet Archive`);
    const jwt = await auth.mintJWT();
    const config = {
      url: `https://fleetengine.googleapis.com/v1/archive/providers/${auth.getProjectId()}/vehicles/${vehicle}:collectVehicleCalls`,
      headers: {
        Authorization: "Bearer " + jwt,
      },
      params: {
        "time_window.start_time.seconds": this.startTimeSeconds,
        "time_window.end_time.seconds": this.endTimeSeconds,
        page_size: 50,
      }
    };
    let entries = [];
    try {
      let response;
      do {
        if (response && response.data.nextPageToken) {
          config.params.page_token = response.data.nextPageToken;
        }
        response = await axios(config);
        if (response.data.apiCalls) {
          entries = _.concat(entries, response.data.apiCalls);
        }
      } while (response.data.nextPageToken);
    } catch (err) {
      console.log(err);
      if (err.data) console.log(JSON.stringify(err.data));
    }
    return entries;
  }

  async fetchDeliveryVehicleLogs(deliveryVehicle, vehicleLogs) {
    if (vehicleLogs.length !== 0) {
      // regular vehicle logs found, not a deliveryVehicle
      return [];
    }

    return [];
  }
}

exports.FleetArchiveLogs = FleetArchiveLogs;
