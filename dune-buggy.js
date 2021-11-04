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
//const browser = require("./components/browser.js");
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

async function main() {
  if (argv.vehicle) {
    console.log("the vehicle id is:", argv.vehicle);
  } else if (argv.trip) {
    console.log("Not implemented yet: the trip id is:", argv.trip);
    return;
  } else if (argv.task) {
    console.log("Not implemented yet: the task id is:", argv.task);
    return;
  } else {
    yargs.showHelp();
    return;
  }

  await auth.init();
  console.log("Loading logs for ", argv.vehicle);
  const rawVehicleLogs = await logging.fetchLogs(
    "vehicle_id",
    [argv.vehicle],
    argv.daysAgo
  );
  const trip_ids = _(rawVehicleLogs)
    .map((x) => _.get(x, "labels.trip_id"))
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
  const rawLogs = _(rawVehicleLogs)
    .concat(tripLogs)
    .sortBy((x) => new Date(x.timestamp).getTime())
    .reverse()
    .value();
  const filePath = `src/rawData.js`;
  const params = {
    APIKEY: argv.apikey,
    // Sorting happens when writing out logs
    rawLogs: rawLogs,
    jwt: await auth.mintJWT(),
    projectId: auth.getProjectId(),
    live: commands.live,
    vehicle: argv.vehicle,
  };

  logging.writeLogs(filePath, params);
  if (commands.historical) {
    //TODO: call 'npm start' to fire up react front end
    //browser.openPage(filePath);
  } else if (commands.live) {
    //TODO: call 'npm start' to fire up react front end
    //browser.servePage(filePath);
  } else {
    yargs.showHelp();
  }
}

main();
