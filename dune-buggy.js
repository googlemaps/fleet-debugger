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
 * Extract trip_ids from vehicle logs, and query again to load
 * create trip logs -- which aren't labeled by vehicle_id.
 */
async function fetchTripLogsForVehicle(vehicleLogs, vehicle_id) {
  console.log("Loading trip logs for vehicle id", vehicle_id);
  const trip_ids = _(vehicleLogs)
    .map((x) => _.split(_.get(x, "labels.trip_id"), ","))
    .flatten()
    .uniq()
    .compact()
    .value();
  let tripLogs = [];
  if (trip_ids.length > 0) {
    console.log("gots trip_ids", trip_ids);
    tripLogs = await logging.fetchLogs(
      "trip_id",
      trip_ids,
      argv.daysAgo,
      "jsonPayload.@type=type.googleapis.com/maps.fleetengine.v1.CreateTripLog"
    );
  } else {
    console.log(`no trips associated with vehicle ${argv.vehicle}`);
  }
  return tripLogs;
}

let label, labelVal;
async function main() {
  if (argv.vehicle) {
    console.log("Fetching logs for vehicle id", argv.vehicle);
    label = "vehicle_id";
    labelVal = argv.vehicle;
  } else if (argv.trip) {
    console.log("Fetching logs for trip id", argv.trip);
    label = "trip_id";
    labelVal = argv.trip;
  } else if (argv.task) {
    console.log("Not implemented yet: the task id is:", argv.task);
    return;
  } else {
    yargs.showHelp();
    return;
  }

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
    params.projectId = auth.getProjectId();
  } else {
    yargs.showHelp();
    return;
  }

  const rawLogs = await logging.fetchLogs(label, [labelVal], argv.daysAgo);
  let tripLogs = [];
  if (argv.vehicle) {
    tripLogs = await fetchTripLogsForVehicle(rawLogs, argv.vehicle);
  }
  params.rawLogs = _(rawLogs)
    .concat(tripLogs)
    .sortBy((x) => new Date(x.timestamp).getTime())
    .reverse()
    .value();

  const filePath = `src/rawData.js`;

  logging.writeLogs(filePath, params);
}

main();
