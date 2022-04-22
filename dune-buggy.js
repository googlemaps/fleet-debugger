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
const { CloudLogs } = require("./components/cloudLoggingDS.js");
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
    mapId: {
      describe: "mapId to use in map",
    },
  });
const argv = yargs.argv;

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
    mapId: argv.mapId,
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
  const cloudLogs = new CloudLogs(argv);

  // TOOD: handle lookup by task -- task logs are trickier in than
  // updateDeliveryVehicleLogs aren't labeled with the task, since there
  // are many tasks at any given time(unlike how
  // relevant updateVehicleLogs are labeled by a trip_id)
  const vehicleLogs = await cloudLogs.fetchVehicleLogs(argv.vehicle, argv.trip);
  const deliveryVehicleLogs = await cloudLogs.fetchDeliveryVehicleLogs(
    argv.vehicle,
    vehicleLogs
  );
  const taskLogs = await cloudLogs.fetchTaskLogsForVehicle(
    argv.vehicle,
    deliveryVehicleLogs
  );
  const tripLogs = await cloudLogs.fetchTripLogsForVehicle(
    argv.vehicle,
    vehicleLogs
  );

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
  const filePath = `public/data.json`;

  logging.writeLogs(filePath, params);
}

main();
