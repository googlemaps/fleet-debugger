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
const fs = require('fs');

/**
 * returns string of html, with minor templating
 * TODO: switch to real template engine (pug?)
 */
function generateHtml(params) {
   let downloadFrag = '';
   let titleFrag = `Fleet Debugger Historical: ${params.vehicle}`;
   if (params.live) {
      downloadFrag = `<a class="btn btn-primary" href='/vehicle.html' download>Click Here to Download</a>`;
      titleFrag = `Fleet Debugger Live: ${params.vehicle}`;
   }
   const template=`<!DOCTYPE html>
   <html>
     <head>
       <title>${titleFrag}</title>
       <script src="https://polyfill.io/v3/polyfill.min.js?features=default"></script>
       <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"></script>
       <script>
   const encodedData = '${params.encodedData}';
   const jsonData = JSON.parse(decodeURIComponent(encodedData));
   console.log('gots jwt', '${params.jwt}');
   console.log('gots projectId', '${params.projectId}');
   console.log('gots logs', jsonData);
   const tripLog = _.find(jsonData.updateVehicleLogs, 'labels.trip_id');
   const recent_trip_id = tripLog && tripLog.labels.trip_id;
   console.log('most recent trip_id', recent_trip_id);

   function getPolyBounds(bounds, p) {
      p.getPath().forEach(function(e) {
         bounds.extend(e);
      });
      return bounds;
   };


   function initMap() {
      function authTokenFetcher(option) {
         const authToken = {
            token: '${params.jwt}',
            expiresInSeconds: 3300,
         };
         console.log('authTokenFetcher called', authToken);
         return authToken;
      }

       const locationProvider = new google.maps.journeySharing.FleetEngineTripLocationProvider({
          projectId: '${params.projectId}',
          authTokenFetcher: authTokenFetcher, 
          tripId: recent_trip_id,
       });
       locationProvider.addListener('update', e => {
       console.log('Trip Update', e.trip);
      });
       locationProvider.addListener('error', e => {
       console.log('error', e);
      });
     function getColor(n) {
        const colors = ['#87b2ab', '#fecab8', '#ff7992', '#e44370', '#223146', '#e4c5bd', '#452141', '#624842', 
                        '#ffffff', '#b2f102', '#eddfb4', '#fde296', '#4a2a36', '#40c9cf', '#e9e3d7', '#f7513a', 
                        '#6da8ad', '#759212', '#97d8df', '#ebddc4', '#13040b', '#b5629a'];
        return _.sample(colors);
     }
     const jsMapView = new google.maps.journeySharing.JourneySharingMapView({ element: document.getElementById("map"), locationProvider});
     const map = jsMapView.map;
     //map = new google.maps.Map(document.getElementById("map"), {});
      const vehicleBounds = new google.maps.LatLngBounds();
      // XXX what about free nav?  Need to handle non-trip updates properly?
      console.log('Number of non-trip updates', _.filter(jsonData.pathCoordinates, c=>  !c.trip_id).length);
      const trips = _(jsonData.pathCoordinates).map('trip_id').uniq().value();
      console.log('gots trips', trips);
     _.forEach(trips, (trip_id, trip_idx) => {
        console.log('working on trip', trip_id, trip_idx);
        const pathCoords = _.filter(jsonData.pathCoordinates, c => c.trip_id == trip_id);
        console.log('gots pathCoords', pathCoords);
        const path = new google.maps.Polyline({
           path: pathCoords,
           geodesic: true,
           strokeColor: getColor(trip_idx),
           strokeOpacity: 0.5,
           strokeWeight: 4,
        });
        getPolyBounds(vehicleBounds, path);
        path.setMap(map);
        const startCoords = pathCoords[0];
        const endCoords = pathCoords[pathCoords.length - 1];
        const startTrip = new google.maps.Marker({
         position: startCoords,
         map:map,
         title:'Start Trip ' + trip_id,
        });
     });

     map.fitBounds(vehicleBounds);
   }
       </script>
     </head>
     <body>
       <div id="map" style="height: 800px;" ></div>
       ${downloadFrag}


       <!-- Async script executes immediately and must be after any DOM elements used in callback. -->
       <script
         src="https://maps.googleapis.com/maps/api/js?key=${params.APIKEY}&callback=initMap&v=beta&libraries=journeySharing"
         async
       ></script>
     </body>
   </html>
   `;
   return template;
}

/**
 * Generates & writes html to specified file.  Existing file at location
 * will be overwritten.
 */
function writeHtml(filePath, params) {
   const htmlStr = generateHtml(params);
   fs.writeFileSync(filePath, htmlStr);
}

exports.writeHtml = writeHtml;
