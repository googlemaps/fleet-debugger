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
const { google } = require("googleapis");
const iam = google.iam("v1");

let authClient;
let authedProject;

/**
 * Initialize authorization -- relies on ADC setup by
 * gcloud.  See README.md for details
 */
async function init() {
  await authorize();
  console.log("Using project", authedProject);
}

/**
 * Create a JWT suitable for use in the JS JS SDK
 */
async function mintJWT() {
  const now = Math.round(Date.now() / 1000);

  //TODO: Expose service name as command line option
  //TODO: Ensure listed service account matches current documented
  //      best practices on devsite.
  const serviceAccount = `server@${authedProject}.iam.gserviceaccount.com`;

  const request = {
    name: `projects/-/serviceAccounts/${serviceAccount}`,
    resource: {
      payload: JSON.stringify({
        iss: serviceAccount,
        sub: serviceAccount,
        aud: "https://fleetengine.googleapis.com/",
        iat: now - 300, // don't trust clocks ... backdate a little bit
        exp: now + 3300,
        authorization: {
          vehicleid: "*",
          tripid: "*",
          taskid: "*",
        },
      }),
    },
    auth: authClient,
  };
  try {
    const response = await iam.projects.serviceAccounts.signJwt(request);
    return response.data.signedJwt;
  } catch (err) {
    // TODO provide link to auth troubling shooting site
    console.error("Failed to mint JWT", err);
  }
}

/**
 * Verify ADC setup and cache authClient and project id for
 * use in other modules
 */
async function authorize() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  authClient = await auth.getClient();
  authedProject = await auth.getProjectId();
}

function getAuthClient() {
  return authClient;
}

function getProjectId() {
  return authedProject;
}

exports.init = init;
exports.mintJWT = mintJWT;
exports.getAuthClient = getAuthClient;
exports.getProjectId = getProjectId;
