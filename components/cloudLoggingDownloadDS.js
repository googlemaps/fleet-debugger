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
const fs = require("fs");

class CloudLoggingDownload extends Datasource {
  constructor(argv) {
    super(argv);
    this.cloudLogs = _.filter(
      JSON.parse(fs.readFileSync(argv.cloudLoggingDownload, "utf8")),
      (log) => {
        // exclude GetTrip logs -- there are too many of them
        return !log.logName.match("get_trip");
      }
    );
    for (let i = 0; i < this.cloudLogs.length; i++) {
      if (this.cloudLogs[i].logName.match("update_delivery_vehicle")) {
        console.log("LMFS Log");
        this.logType = "LMFS";
        break;
      }
      if (this.cloudLogs[i].logName.match("update_vehicle")) {
        console.log("ODRD Log");
        this.logType = "ODRD";
        break;
      }
    }
  }
  /*
   * Extract trip_ids from vehicle logs, and query again to
   * get the createTrip/update trip calls that may not be labeled
   * with a vehicle
   */
  async fetchTripLogsForVehicle(vehicle_id, vehicleLogs) {
    if (!vehicle_id) {
      return [];
    }
    console.log("Loading trip logs for vehicle id", vehicle_id);
    const trip_ids = _(vehicleLogs)
      .map((x) => _.split(_.get(x, "labels.trip_id"), ","))
      .flatten()
      .uniq()
      .compact()
      .value();
    if (trip_ids.length > 0) {
      console.log("trip_ids found", trip_ids);
    } else {
      console.log(`no trips associated with vehicle id ${this.argv.vehicle}`);
    }
    return [];
  }

  /*
   * Extract task_ids from vehicle logs, and query again to
   * get the createTask/updateTask calls that may not be labeled
   * with a vehicle
   */
  async fetchTaskLogsForVehicle(vehicle_id /* vehicleLogs */) {
    if (!vehicle_id) {
      return [];
    }
    if (this.logType !== "LMFS") {
      return [];
    }
    console.log("Task logs not currently supported in logging downloads");
    return [];
  }

  async fetchVehicleLogs(vehicle, trip) {
    if (this.logType !== "ODRD") {
      return [];
    }
    const label = vehicle ? "vehicle_id" : "trip_id";
    const labelVal = vehicle ? vehicle : trip;

    console.log(`Fetching logs for ${label} = ${labelVal}`);
    return this.cloudLogs;
  }

  async fetchDeliveryVehicleLogs(deliveryVehicle /*, vehicleLogs */) {
    if (this.logType !== "LMFS") {
      return [];
    }
    console.log("fetching logs for deliveryVehicle", deliveryVehicle);
    return this.cloudLogs;
  }
}

exports.CloudLoggingDownload = CloudLoggingDownload;
