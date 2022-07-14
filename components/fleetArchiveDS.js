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
const logging = require("./logging.js");
const _ = require("lodash");

class FleetArchiveLogs extends Datasource {
  constructor(argv) {
    super(argv);
    this.startTimeSeconds = Math.round(
      new Date(argv.startTime).getTime() / 1000
    );
    this.endTimeSeconds = Math.round(new Date(argv.endTime).getTime() / 1000);
  }
  async fetchTripLogsForVehicle(vehicle_id, vehicleLogs, jwt) {
    if (!vehicle_id) {
      return [];
    }
    console.log("Loading trip logs for vehicle id", vehicle_id);
    const trip_ids = _(vehicleLogs)
      .map(
        (logEntry) =>
          _.get(logEntry, "createVehicle.response.currentTrips") ||
          _.get(logEntry, "getVehicle.response.currentTrips") ||
          _.get(logEntry, "updateVehicle.response.currentTrips")
      )
      .flatten()
      .uniq()
      .compact()
      .value();
    let tripLogs = [];
    if (trip_ids.length > 0) {
      console.log("trip_ids found", trip_ids);
      for (const trip_id of trip_ids) {
        const logs = await logging.fetchLogsFromArchive(
          "trips",
          trip_id,
          this.startTimeSeconds,
          this.endTimeSeconds,
          jwt
        );
        if (logs) {
          tripLogs = _.concat(tripLogs, logs);
        }
      }
    } else {
      console.log(`no trips associated with vehicle id ${vehicle_id}`);
    }
    return tripLogs;
  }

  async fetchTaskLogsForVehicle(vehicle_id, vehicleLogs, jwt) {
    if (!vehicle_id) {
      return [];
    }
    console.log("Loading tasks logs for deliveryVehicle id", vehicle_id);
    const task_ids = _(vehicleLogs)
      .map((logEntry) =>
        _.get(logEntry, "createDeliveryVehicle.response.remainingVehicleJourneySegments") ||
        _.get(logEntry, "getDeliveryVehicle.response.remainingVehicleJourneySegments") ||
        _.get(logEntry, "updateDeliveryVehicle.response.remainingVehicleJourneySegments")
      )
      .flatten()
      .map((segment) => _.get(segment, "stop.tasks"))
      .flatten()
      .map((tasks) => _.get(tasks, "taskId"))
      .flatten()
      .uniq()
      .compact()
      .value();
    let taskLogs = [];
    if (task_ids.length > 20) {
      // See https://github.com/googlemaps/fleet-debugger/issues/100
      console.warn("Too many tasks found, limiting detailed logs to first 20");
      task_ids = task_ids.slice(0, 20);
    }
    if (task_ids.length > 0) {
      console.log("gots task_ids", task_ids);
      for (const task_id of task_ids) {
        const logs = await logging.fetchLogsFromArchive(
          "tasks",
          task_id,
          this.startTimeSeconds,
          this.endTimeSeconds,
          jwt
        );
        if (logs) {
          taskLogs = _.concat(taskLogs, logs);
        }
      }
    } else {
      console.log(`no tasks associated with vehicle id ${this.argv.vehicle}`);
    }
    return taskLogs;
  }

  async fetchVehicleLogs(vehicle, trip, jwt) {
    const label = vehicle ? "vehicles" : "trips";
    const labelVal = vehicle ? vehicle : trip;

    console.log(`Fetching logs for ${label} = ${labelVal} from Fleet Archive`);
    return await logging.fetchLogsFromArchive(
      label,
      labelVal,
      this.startTimeSeconds,
      this.endTimeSeconds,
      jwt
    );
  }

  async fetchDeliveryVehicleLogs(deliveryVehicle, vehicleLogs, jwt) {
    if (vehicleLogs.length !== 0) {
      // regular vehicle logs found, not a deliveryVehicle
      return [];
    }
    console.log("fetching logs for deliveryVehicle", deliveryVehicle);
    return await logging.fetchLogsFromArchive(
      "deliveryVehicles",
      deliveryVehicle,
      this.startTimeSeconds,
      this.endTimeSeconds,
      jwt
    );
  }
}

exports.FleetArchiveLogs = FleetArchiveLogs;
