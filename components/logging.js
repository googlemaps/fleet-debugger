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
//const {Logging} = require('@google-cloud/logging');
const {google} = require('googleapis');
const logging = google.logging('v2');
const auth = require('./auth.js');
const _ = require('lodash');

/**
 * Uses cloud logging APIs to list log entries from the
 * fleet engine resource matching the specified label.
 */
async function fetchLogs(label, lableValue) {
   // TDOO better handling of date range for search
   const filterString = `resource.type=fleetengine.googleapis.com/Fleet labels.${label}=${lableValue} timestamp>2021-10-7`;
   let entries = [];
   try {
      const request = {
         resourceNames: [ 'projects/' + auth.getProjectId() ],
         filter: filterString,
         auth: auth.getAuthClient(),
         pageSize: 500,
         order_by: 'timestamp desc',
      }
      let logs;
      do {
         if (logs && logs.data.nextPageToken) {
            request.pageToken = logs.data.nextPageToken;
         }
         logs = await logging.entries.list(request);
         if (logs.data.entries) {
            entries = _.concat(entries, logs.data.entries);
         }
      } while (logs.data.nextPageToken);
   } catch (e) {
      console.log('failed to list logs', e);
   }
   return entries;
}


exports.fetchLogs = fetchLogs;
