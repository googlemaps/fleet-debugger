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
const { Serve } = require("./components/serve.js");
const { Bigquery } = require("./components/bigqueryDS.js");
const { FleetArchiveLogs } = require("./components/fleetArchiveDS.js");
const _ = require("lodash");

const commands = {};
const yargs = require("yargs/yargs")(process.argv.slice(2))
  .command("live", "view live vehicle movement", () => {
    commands.live = true;
  })
  .command("historical", "view history vehicle movement", () => {
    commands.historical = true;
  })
  .command("serve", "start dune-buggy in server mode", () => {
    commands.serve = true;
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
    port: {
      describe: "port to use when serve mode enabled",
    },
    startTime: {
      describe:
        "startTime -- Only request data newer that startTime .. Must be an something that used in new Date()",
      default: new Date(0).toISOString(),
    },
    endTime: {
      describe:
        "endTime -- Only request data older that endTime .. Must be an something that used in new Date()",
      default: new Date().toISOString(),
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
    bigquery: {
      describe:
        "Use specified bigquery dataset as datasource.  Assumes current user has access, and standard format.  Assumes dataset has separate tables for each api method",
    },
    fleetarchive: {
      describe:
        "Use the fleet archive dataset as datasource.",
        boolean: true,
    },
  });
const argv = yargs.argv;

async function getLogs(dataSource, params, vehicle, trip) {
  // TOOD: handle lookup by task -- task logs are trickier in than
  // updateDeliveryVehicleLogs aren't labeled with the task, since there
  // are many tasks at any given time(unlike how
  // relevant updateVehicleLogs are labeled by a trip_id)
  const vehicleLogs = await dataSource.fetchVehicleLogs(
    vehicle,
    trip,
    params.jwt
  );
  const deliveryVehicleLogs = await dataSource.fetchDeliveryVehicleLogs(
    vehicle,
    vehicleLogs,
    params.jwt
  );
  const taskLogs = await dataSource.fetchTaskLogsForVehicle(
    vehicle,
    deliveryVehicleLogs,
    params.jwt
  );
  const tripLogs = await dataSource.fetchTripLogsForVehicle(
    vehicle,
    vehicleLogs,
    params.jwt
  );

  params.solutionType = vehicleLogs.length === 0 ? "LMFS" : "ODRD";

  params.rawLogs = _(vehicleLogs)
    .concat(tripLogs)
    .concat(deliveryVehicleLogs)
    .concat(taskLogs)
    .sortBy((x) => new Date(x.timestamp || x.serverTime).getTime())
    .reverse()
    .value();
}

async function main() {
  if (argv.vehicle) {
    console.log("Fetching logs for vehicle id", argv.vehicle);
  } else if (argv.trip) {
    console.log("Fetching logs for trip id", argv.trip);
  } else if (argv.task) {
    console.log("Not implemented yet: the task id is:", argv.task);
    return;
  } else if ((argv.startTime || argv.endTime) && !argv.bigquery) {
    console.log(
      "startTime and endTime only supported on bigquery dataset.  Use --daysAgo"
    );
    return;
  } else if (!commands.serve) {
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
    if (argv.fleetarchive) {
      params.jwt = await auth.mintJWT();
    }
  } else if (commands.live) {
    await auth.init();
    params.jwt = await auth.mintJWT();
  } else if (commands.serve) {
    await auth.init();
  } else {
    yargs.showHelp();
    return;
  }

  // Always include project id -- it's used
  // by utils/clean-demos.js
  params.projectId = auth.getProjectId();
  let logs;

  if (argv.bigquery) {
    logs = new Bigquery(argv);
    params.logSource = "bigquery";
  } else if (argv.fleetarchive) {
    logs = new FleetArchiveLogs(argv);
    params.logSource = "fleetarchive";
  } else {
    logs = new CloudLogs(argv);
    params.logSource = "cloudlogs";
  }

  if (commands.serve) {
    Serve(argv.port || 3000, getLogs, logs, params);
  } else {
    await getLogs(logs, params, argv.vehicle, argv.trip);

    if (params.rawLogs.length === 0) {
      console.error("\n\nError:No log entries found\n\n");
      return;
    }
    const filePath = `public/data.json`;

    logging.writeLogs(filePath, params);
  }
}

main();
