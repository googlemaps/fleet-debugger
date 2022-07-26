/*
 * Copyvaright 2021 Google LLC
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

class CloudLogs extends Datasource {
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
    let tripLogs = [];
    if (trip_ids.length > 0) {
      console.log("trip_ids found", trip_ids);
      tripLogs = await logging.fetchLogs(
        "trip_id",
        trip_ids,
        this.argv.daysAgo,
        "jsonPayload.@type=type.googleapis.com/maps.fleetengine.v1.CreateTripLog"
      );
    } else {
      console.log(`no trips associated with vehicle id ${this.argv.vehicle}`);
    }
    return tripLogs;
  }

  /*
   * Extract task_ids from vehicle logs, and query again to
   * get the createTask/updateTask calls that may not be labeled
   * with a vehicle
   */
  async fetchTaskLogsForVehicle(vehicle_id, vehicleLogs) {
    if (!vehicle_id) {
      return [];
    }
    console.log("Loading tasks logs for deliveryVehicle id", vehicle_id);
    let task_ids = _(vehicleLogs)
      .map((logEntry) =>
        _.get(logEntry, "jsonPayload.response.remainingVehicleJourneySegments")
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
      taskLogs = await logging.fetchLogs(
        "task_id",
        task_ids,
        this.argv.daysAgo,
        "",
        this.argv.lmfsMrOverride
      );
    } else {
      console.log(`no tasks associated with vehicle id ${this.argv.vehicle}`);
    }
    return taskLogs;
  }

  async fetchVehicleLogs(vehicle, trip) {
    const label = vehicle ? "vehicle_id" : "trip_id";
    const labelVal = vehicle ? vehicle : trip;

    console.log(`Fetching logs for ${label} = ${labelVal}`);
    return await logging.fetchLogs(label, [labelVal], this.argv.daysAgo);
  }

  async fetchDeliveryVehicleLogs(deliveryVehicle, vehicleLogs) {
    if (vehicleLogs.length !== 0) {
      // regular vehicle logs found, not a deliveryVehicle
      return [];
    }
    // TODO: is it more efficient to run the log query twice
    // or to update the log filter with an OR?
    //
    // Could also force the user to specify which type of vehicle they're interested
    // in on the command line -- but that seems unfriendly & error prone
    console.log("fetching logs for deliveryVehicle", deliveryVehicle);
    return await logging.fetchLogs(
      "delivery_vehicle_id",
      [deliveryVehicle],
      this.argv.daysAgo,
      "",
      this.lmfsMrOverride
    );
  }
}

exports.CloudLogs = CloudLogs;
