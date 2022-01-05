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

/*
 * Replaces the vehicle and project ids from a data
 * set with generic placeholders.
 */
const process = require("process");
const logging = require("../components/logging.js");
const fs = require("fs");

const yargs = require("yargs/yargs")(process.argv.slice(2)).options({
  source: {
    describe: "source file",
    required: true,
  },
  dest: {
    describe: "destination file",
    required: true,
  },
});
const argv = yargs.argv;

async function main() {
  const data = fs.readFileSync(argv.source);
  const params = JSON.parse(data);
  const genericProjectId = "sample-project-id";
  const genericVehicle = "sample-vehicle-id";
  delete params.APIKEY;
  delete params.jwt;
  if (!params.projectId) {
    console.error("no project id found");
    return 1;
  }
  if (!params.vehicle) {
    console.error("no project id found");
    return 1;
  }
  // Cleanup up ids in the dataset.  This makes huge assumptions
  // about the format of the input data (ie project-id and vehicle are
  // uuids) and is not guaranteed to work in all cases.
  const cleanedString = JSON.stringify(params.rawLogs)
    .replace(new RegExp(params.projectId, "g"), "sample-project-id")
    .replace(new RegExp(params.vehicle, "g"), "sample-vehicle-id")
    .replace(new RegExp(process.env.USER, "g"), "user");
  params.rawLogs = JSON.parse(cleanedString);
  params.projectId = genericProjectId;
  params.vehicle = genericVehicle;
  logging.writeLogs(argv.dest, params);
}

main();
