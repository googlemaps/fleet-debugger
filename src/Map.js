/*
 * Map.js
 *
 * Uses the react-wrapper to make using google maps js sdk
 * easier in react.  Beyond basic loading doesn't pretend to
 * act like a normal react component.
 */
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import React, { useEffect, useRef, ReactElement } from "react";
import _ from "lodash";

let minDate;
let maxDate;
let allPaths = [];
let allMarkers = [];
let map;
let pathCoords;
let rawLogs;
let dataMakers = [];
let trafficLayer;
const bubbleMap = {};
const toggleHandlers = {};

const render = (status: Status): ReactElement => {
  if (status === Status.LOADING) return <h3>{status} ..</h3>;
  if (status === Status.FAILURE) return <h3>{status} ...</h3>;
  return null;
};

function addTripPolys(map) {
  _.forEach(allPaths, (p) => p.setMap(null));
  allPaths = [];
  _.forEach(allMarkers, (m) => m.setMap(null));
  allMarkers = [];

  const trips = _(pathCoords).map("trip_id").uniq().value();
  const vehicleBounds = new window.google.maps.LatLngBounds();

  let firstPoly = true;
  _.forEach(trips, (trip_id, trip_idx) => {
    const fullTripCoords = _.filter(pathCoords, (c) => c.trip_id === trip_id);
    const tripCoords = _.filter(
      fullTripCoords,
      (c) => !minDate || (c.date >= minDate && c.date <= maxDate)
    );
    if (tripCoords.length > 0) {
      let icons = [];

      //Add marker for "current vehicle location"  This isn't quite correct:
      //it doesn't handle non-trip segements properly
      if (firstPoly) {
        firstPoly = false;
        icons.push({
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            strokeColor: "#0000FF",
          },
          offset: "0%",
        });
      }

      const path = new window.google.maps.Polyline({
        path: tripCoords,
        icons: icons,
        geodesic: true,
        strokeColor: getColor(trip_id),
        strokeOpacity: 0.75,
        strokeWeight: 6,
      });
      getPolyBounds(vehicleBounds, path);
      path.setMap(map);
      const startCoords = fullTripCoords[0];
      // TODO: add symbols to polyline to indicate important parts of polyline
      // (ie trip or vehicle status changes)
      if (startCoords.date >= minDate && startCoords.date <= maxDate) {
        const startTrip = new window.google.maps.Marker({
          position: startCoords,
          map: map,
          title: "Start Trip " + trip_id,
        });
        allMarkers.push(startTrip);
      }
      allPaths.push(path);
    }
  });
  return vehicleBounds;
}

function MyMapComponent({
  center,
  zoom,
}: {
  center: google.maps.LatLngLiteral,
  zoom: number,
}) {
  const ref = useRef();

  useEffect(() => {
    map = new window.google.maps.Map(ref.current, {});
    const vehicleBounds = addTripPolys(map);
    map.fitBounds(vehicleBounds);
  });

  return <div ref={ref} id="map" style={{ height: "500px" }} />;
}

function getPolyBounds(bounds, p) {
  p.getPath().forEach(function (e) {
    bounds.extend(e);
  });
  return bounds;
}

/*
 * Deterministically assign a color per trip by hasing the tripid.
 * Colors were chosen for visibility
 */
function getColor(trip_id) {
  const colors = ["#2d7dd2", "#97cc04", "#eeb902", "#f45d01", "#474647"];
  const simpleHash = _(trip_id)
    .map((x) => x.charCodeAt(0))
    .sum();
  return colors[simpleHash % colors.length];
}

function Map(props) {
  pathCoords = props.logData.pathCoords;
  rawLogs = props.logData.rawLogs;

  return (
    <Wrapper apiKey="AIzaSyACBHVQLegKXY5TOX0RcY0A_ugq3cAMmv4" render={render}>
      <MyMapComponent />
    </Wrapper>
  );
}

/*
 * Handler for timewindow change.  Updates global min/max date globals
 * and recomputes the paths as well as all the bubble markers to respect the
 * new date values.
 *
 * Debounced to every 100ms as a blance between performance and reactivity when
 * the slider is dragged.
 */
const onSliderChangeMap = _.debounce((rangeStart, rangeEnd) => {
  minDate = new Date(rangeStart);
  maxDate = new Date(rangeEnd);
  addTripPolys(map);
  _.forEach(toggleHandlers, (handler, name) => {
    if (bubbleMap[name]) {
      handler(true);
    }
  });
}, 100);

function addMarkersToMapForData(data) {
  _.forEach(dataMakers, (m) => m.setMap(null));
  dataMakers = [];
  const svgMarker = {
    path: "M10.453 14.016l6.563-6.609-1.406-1.406-5.156 5.203-2.063-2.109-1.406 1.406zM12 2.016q2.906 0 4.945 2.039t2.039 4.945q0 1.453-0.727 3.328t-1.758 3.516-2.039 3.070-1.711 2.273l-0.75 0.797q-0.281-0.328-0.75-0.867t-1.688-2.156-2.133-3.141-1.664-3.445-0.75-3.375q0-2.906 2.039-4.945t4.945-2.039z",
    fillColor: "blue",
    fillOpacity: 0.6,
    strokeWeight: 0,
    rotation: 0,
    scale: 2,
    anchor: new google.maps.Point(15, 30),
  };

  const rawLocation = _.get(
    data,
    "jsonPayload.response.lastLocation.rawLocation"
  );
  if (rawLocation) {
    const status = _.get(data, "jsonPayload.response.status");
    const state = _.get(data, "jsonPayload.response.state");
    const locationForLog = new window.google.maps.Marker({
      position: { lat: rawLocation.latitude, lng: rawLocation.longitude },
      map: map,
      icon: svgMarker,
      title: "Vehicle state " + state + " Trip Status " + status,
    });
    dataMakers.push(locationForLog);
  }
  // TODO: for non-vehicle api calls could attempt to interpolate the location
}

/*
 * GenerateBubbles() -- helper function for generating map features based
 * on per-log entry data.
 *
 * Handles the gunk of iterating over log entries and clearing/setting the map
 */
function GenerateBubbles(bubbleName, cb) {
  return (showBubble) => {
    _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
    delete bubbleMap[bubbleName];
    if (showBubble) {
      bubbleMap[bubbleName] = _(rawLogs)
        .filter((le) => !minDate || (le.date >= minDate && le.date <= maxDate))
        .map((le) => {
          const lastLocation = _.get(le, "jsonPayload.response.lastLocation");
          let rawLocation;
          let bubble = undefined;
          if (lastLocation && (rawLocation = lastLocation.rawLocation)) {
            bubble = cb(
              new google.maps.LatLng({
                lat: rawLocation.latitude,
                lng: rawLocation.longitude,
              }),
              lastLocation,
              le
            );
          }
          return bubble;
        })
        .compact()
        .value();
    }
  };
}

/*
 * Draws circles on map with a radius equal to the
 * GPS accuracy.
 */
toggleHandlers["showGPSBubbles"] = GenerateBubbles(
  "showGPSBubbles",
  (rawLocationLatLng, lastLocation, logEntry) => {
    const accuracy = lastLocation.rawLocationAccuracy;
    if (accuracy) {
      return new google.maps.Circle({
        strokeColor: "#0000F0",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: "#0000F0",
        fillOpacity: 0.2,
        map,
        center: rawLocationLatLng,
        radius: accuracy, // units is this actually meters?
      });
    }
  }
);

/*
 * Draws arrows on map showing the measured heading
 * of the vehicle (ie which direction vehicle was traveling
 */
toggleHandlers["showHeading"] = GenerateBubbles(
  "showHeading",
  (rawLocationLatLng, lastLocation, logEntry) => {
    // Note: Heading & accuracy are only on the _request_ not the
    // response.
    const heading = _.get(
      logEntry,
      "jsonPayload.request.vehicle.lastLocation.heading"
    );
    const accuracy = _.get(
      logEntry,
      "jsonPayload.request.vehicle.lastLocation.bearingAccuracy"
    );

    // Not currently using accuracy. How to show it?  Maybe opacity of the arrorw?
    const arrowLength = 20; // meters??
    if (!(heading && accuracy)) {
      return;
    }
    const headingLine = new google.maps.Polyline({
      strokeColor: "#0000F0",
      strokeOpacity: 0.6,
      strokeWeight: 2,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            strokeColor: "#0000FF",
            strokeWeight: 4,
          },
          offset: "100%",
        },
      ],
      map,
      path: [
        rawLocationLatLng,
        google.maps.geometry.spherical.computeOffset(
          rawLocationLatLng,
          arrowLength,
          heading
        ),
      ],
    });
    google.maps.event.addListener(headingLine, "click", () => {
      console.log("gots click on", heading, rawLocationLatLng);
      const panorama = new google.maps.StreetViewPanorama(
        document.getElementById("map"),
        {
          position: rawLocationLatLng,
          pov: { heading: heading, pitch: 10 },
          addressControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_CENTER,
          },
          linksControl: false,
          panControl: false,
          enableCloseButton: true,
        }
      );
    });
    return headingLine;
  }
);

/*
 * Draws circles on the map. Color indicates vehicle speed at that
 * location.
 */
toggleHandlers["showSpeed"] = GenerateBubbles(
  "showSpeed",
  (rawLocationLatLng, lastLocation, logEntry) => {
    const speed = lastLocation.speed;
    if (lastLocation.speed === undefined) {
      return;
    }
    // multiple by 3 to attempt to use full range
    const clampedSpeed = 255 - Math.min(255, Math.round(Math.abs(speed) * 3));
    const color = "#50" + clampedSpeed.toString(16).padStart(2, "0") + "50";
    return new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.5,
      fillColor: color,
      fillOpacity: 0.5,
      map,
      center: rawLocationLatLng,
      radius: 10,
    });
  }
);

toggleHandlers["showTraffic"] = function(enabled) {
   if (!trafficLayer) {
      trafficLayer = new google.maps.TrafficLayer();
   }
   if (enabled) {
      trafficLayer.setMap(map);
   } else {
      trafficLayer.setMap(null);
   }
}

function updateMapToggles(toggleName, enabled) {
  toggleHandlers[toggleName](enabled);
}

export {
  Map as default,
  onSliderChangeMap,
  addMarkersToMapForData,
  updateMapToggles,
};
