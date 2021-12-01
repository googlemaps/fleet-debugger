#!/usr/bin/env node
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
const process = require("process");
const auth = require("./components/auth.js");
const logging = require("./components/logging.js");
const _ = require("lodash");

const commands = {};
const yargs = require("yargs/yargs")(process.argv.slice(2))
  .command("live", "view live vehicle movement", () => {
    commands.live = true;
  })
  .command("historical", "view history vehicle movement", () => {
    commands.historical = true;
  })
  .options({
    vehicle: {
      describe: "vehicle id to debug",
    },
    trip: {
      describe: "trip id to debug",
    },
    task: {
      describe: "task id to debug",
    },
    daysAgo: {
      describe:
        "Cloud logging is very slow when scanning for old logs, limit search to at most this many days ago",
      default: 2,
    },
    apikey: {
      describe: "apikey",
      required: true,
    },
  });
const argv = yargs.argv;

/*
 * Extract trip_ids from vehicle logs, and query again to
 * get the createTrip/update trip calls that may not be labeled
 * with a vehicle
 */
async function fetchTripLogsForVehicle(vehicle_id, vehicleLogs) {
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
      argv.daysAgo,
      "jsonPayload.@type=type.googleapis.com/maps.fleetengine.v1.CreateTripLog"
    );
  } else {
    console.log(`no trips associated with vehicle id ${argv.vehicle}`);
  }
  return tripLogs;
}

/*
 * Extract task_ids from vehicle logs, and query again to
 * get the createTask/updateTask calls that may not be labeled
 * with a vehicle
 */
async function fetchTaskLogsForVehicle(vehicle_id, vehicleLogs) {
  if (!vehicle_id) {
    return [];
  }
  console.log("Loading tasks logs for deliveryVehicle id", vehicle_id);
  const task_ids = _(vehicleLogs)
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
  if (task_ids.length > 0) {
    console.log("gots task_ids", task_ids);
    taskLogs = await logging.fetchLogs("task_id", task_ids, argv.daysAgo);
  } else {
    console.log(`no tasks associated with vehicle id ${argv.vehicle}`);
  }
  return taskLogs;
}

async function fetchVehicleLogs(vehicle, trip) {
  const label = vehicle ? "vehicle_id" : "trip_id";
  const labelVal = vehicle ? vehicle : trip;

  console.log(`Fetching logs for ${label} = ${labelVal}`);
  return await logging.fetchLogs(label, [labelVal], argv.daysAgo);
}

async function fetchDeliveryVehicleLogs(deliveryVehicle, vehicleLogs) {
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
    argv.daysAgo
  );
}

async function main() {
  if (argv.vehicle) {
    console.log("Fetching logs for vehicle id", argv.vehicle);
  } else if (argv.trip) {
    console.log("Fetching logs for trip id", argv.trip);
  } else if (argv.task) {
    console.log("Not implemented yet: the task id is:", argv.task);
    return;
  } else {
    yargs.showHelp();
    return;
  }
  // TODO: error if both trip & vehicle being set

  const params = {
    APIKEY: argv.apikey,
    live: commands.live,
    vehicle: argv.vehicle,
  };

  if (commands.historical) {
    await auth.init();
  } else if (commands.live) {
    await auth.init();
    params.jwt = await auth.mintJWT();
  } else {
    yargs.showHelp();
    return;
  }

  // Always include project id -- it's used
  // by utils/clean-demos.js
  params.projectId = auth.getProjectId();

  // TOOD: handle lookup by task -- task logs are trickier in than
  // updateDeliveryVehicleLogs aren't labeled with the task, since there
  // are many tasks at any given time(unlike how
  // relevant updateVehicleLogs are labeled by a trip_id)
  const vehicleLogs = await fetchVehicleLogs(argv.vehicle, argv.trip);
  const deliveryVehicleLogs = await fetchDeliveryVehicleLogs(
    argv.vehicle,
    vehicleLogs
  );
  const taskLogs = await fetchTaskLogsForVehicle(
    argv.vehicle,
    deliveryVehicleLogs
  );
  const tripLogs = await fetchTripLogsForVehicle(argv.vehicle, vehicleLogs);

  params.solutionType = vehicleLogs.length === 0 ? "LMFS" : "ODRD";

  params.rawLogs = _(vehicleLogs)
    .concat(tripLogs)
    .concat(deliveryVehicleLogs)
    .concat(taskLogs)
    .sortBy((x) => new Date(x.timestamp).getTime())
    .reverse()
    .value();

  if (params.rawLogs.length === 0) {
    console.error("\n\nError:No log entries found\n\n");
    return;
  }
  const filePath = `src/rawData.js`;

  logging.writeLogs(filePath, params);
}

main();
