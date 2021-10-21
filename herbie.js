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
const process = require('process');
const auth = require('./components/auth.js');
const browser = require('./components/browser.js');
const htmlGen = require('./components/htmlGen.js');
const logging = require('./components/logging.js');
const analysis = require('./components/analysis.js');

const commands = {};
const yargs = require('yargs/yargs')(process.argv.slice(2))
  .command('live', 'view live vehicle movement', () => {commands.live=true})
  .command('historical', 'view history vehicle movement', () => {commands.historical=true})
  .options({
    'vehicle': {
      describe: 'vehicle id to debug',
    },
    'trip': {
      describe: 'trip id to debug',
    },
    'task': {
      describe: 'task id to debug',
    },
    'apikey': {
      describe: 'apikey',
      required:true,
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
     yargs.showHelp()
     return;
   }

   await auth.init();
   console.log('Loading logs for ', argv.vehicle);
   const entries = await logging.fetchLogs('vehicle_id', argv.vehicle);
   const jsonData = analysis.processLogs(entries);
   const filePath = `/tmp/vehicle-${argv.vehicle}.html`;
   // TODO: move rest of data into encode block
   const params = {
      APIKEY:argv.apikey,
      encodedData: encodeURIComponent(JSON.stringify(jsonData)),
      jwt: await auth.mintJWT(),
      projectId: auth.getProjectId(),
      live: commands.live,
      vehicle:argv.vehicle,
   }

   htmlGen.writeHtml(filePath, params);
   // TODO move real work into modules
   if (commands.historical) {
      browser.openPage(filePath);
   } else if (commands.live) {
      browser.servePage(filePath);
   } else {
      yargs.showHelp();
   }
}

main();
