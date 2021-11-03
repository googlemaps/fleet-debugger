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
const open = require("open");
const fs = require("fs");
const http = require("http");

/*
 * Opens system default brower to specified path
 */
function openPage(filePath) {
  open(filePath);
}

/*
 * Starts up local express server & opens browser to
 * it
 */
function servePage(filePath) {
  http
    .createServer(function (req, res) {
      fs.readFile(filePath, function (err, data) {
        if (err) {
          res.writeHead(404);
          res.end(JSON.stringify(err));
          return;
        }
        res.setHeader("Content-Type", "text/html");
        res.writeHead(200);
        res.end(data);
      });
    })
    .listen(8080);

  // TODO: use real paths
  // TODO: expose endpoints to regenerate html & reload
  //       so that new logs can be shown
  open("http://localhost:8080/vehicle.html");
}
exports.openPage = openPage;
exports.servePage = servePage;
