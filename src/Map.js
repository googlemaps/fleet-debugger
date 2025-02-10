// src/Map.js

import { useEffect, useRef, useState } from "react";
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import _ from "lodash";
import { getQueryStringValue, setQueryStringValue } from "./queryString";
import Utils, { log } from "./Utils";
import PolylineCreation from "./PolylineCreation";
import { decode } from "s2polyline-ts";
import TrafficPolyline from "./TrafficPolyline";

let minDate;
let maxDate;
let allPaths = [];
let allMarkers = [];
let map;
let apikey;
let mapId;
let dataMakers = [];
let trafficLayer;
const bubbleMap = {};
const toggleHandlers = {};
let panorama;
let jwt;
let projectId;
let locationProvider;
let solutionType;
let tripLogs;
let taskLogs;
let setFeaturedObject;
let setTimeRange;

const render = (status) => {
  if (status === Status.LOADING) return <h3>{status} ..</h3>;
  if (status === Status.FAILURE) return <h3>{status} ...</h3>;
  return null;
};

function addTripPolys(map) {
  _.forEach(allPaths, (p) => p.setMap(null));
  allPaths = [];
  _.forEach(allMarkers, (m) => m.setMap(null));
  allMarkers = [];

  const trips = tripLogs.getTrips();
  const vehicleBounds = new window.google.maps.LatLngBounds();
  let lastVehicleCoords;
  _.forEach(trips, (trip) => {
    const tripCoords = trip.getPathCoords(minDate, maxDate);
    if (tripCoords.length > 0) {
      lastVehicleCoords = _.last(tripCoords);
      const path = new window.google.maps.Polyline({
        path: tripCoords,
        geodesic: true,
        strokeColor: getColor(trip.tripIdx),
        strokeOpacity: 0.5,
        strokeWeight: 6,
      });
      google.maps.event.addListener(path, "mouseover", () => {
        path.setOptions({
          strokeOpacity: 1,
          strokeWeight: 8,
        });
      });
      google.maps.event.addListener(path, "mouseout", () => {
        path.setOptions({
          strokeOpacity: 0.5,
          strokeWeight: 6,
        });
      });
      google.maps.event.addListener(path, "click", () => {
        const fd = trip.getFeaturedData();
        setFeaturedObject(fd);
        // TODO: https://github.com/googlemaps/fleet-debugger/issues/79
        // this time range won't capture the createTrip logs
        setTimeRange(fd.firstUpdate.getTime(), fd.lastUpdate.getTime());
      });
      getPolyBounds(vehicleBounds, path);
      path.setMap(map);
      allPaths.push(path);
    }
  });
  if (lastVehicleCoords) {
    const urlBase = "http://maps.google.com/mapfiles/kml/shapes/";
    const lastVehicleLocMark = new window.google.maps.Marker({
      position: lastVehicleCoords,
      map: map,
      icon: {
        url: urlBase + (solutionType === "LMFS" ? "truck.png" : "cabs.png"),
        scaledSize: new google.maps.Size(18, 18),
      },
      title: "Last Location",
    });
    allMarkers.push(lastVehicleLocMark);
  }
  return vehicleBounds;
}

/*
 * Creates the map object using a journeySharing location
 * provider.
 */
function initializeMapObject(element) {
  // In a more normal implementation authTokenFetcher
  // would actually be making a RPC to a backend to generate
  // the jwt.  For debugging use cases the jwt gets bundled into
  // the extracted log data.
  function authTokenFetcher(options) {
    // TODO #25 - bake in actual expiration time -- and give a
    // better error message for expired jwts
    console.log("Ignoring options using prebuilt jwt", options);
    const authToken = {
      token: jwt,
    };
    return authToken;
  }

  locationProvider =
    new google.maps.journeySharing.FleetEngineTripLocationProvider({
      projectId,
      authTokenFetcher,
    });
  const jsMapView = new google.maps.journeySharing.JourneySharingMapView({
    element: element,
    locationProvider,
    mapOptions: {
      mapId: mapId,
      mapTypeControl: true,
      streetViewControl: true,
    },
  });
  const map = jsMapView.map;

  return map;
}

function MyMapComponent(props) {
  const ref = useRef();
  const [showPolylineUI, setShowPolylineUI] = useState(false);
  const [polylines, setPolylines] = useState([]);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const urlZoom = getQueryStringValue("zoom");
    const urlCenter = getQueryStringValue("center");
    const urlHeading = getQueryStringValue("heading");
    map = initializeMapObject(ref.current);
    const vehicleBounds = addTripPolys(map);
    if (urlZoom && urlCenter) {
      log("setting zoom & center from url", urlZoom, urlCenter);
      map.setZoom(parseInt(urlZoom));
      map.setCenter(JSON.parse(urlCenter));
    } else {
      map.fitBounds(vehicleBounds);
    }

    if (urlHeading) {
      map.setHeading(parseInt(urlHeading));
    }
    map.setOptions({ maxZoom: 100 });
    map.addListener("zoom_changed", () => {
      setQueryStringValue("zoom", map.getZoom());
    });

    map.addListener("heading_changed", () => {
      setQueryStringValue("heading", map.getHeading());
    });

    map.addListener(
      "center_changed",
      _.debounce(() => {
        setQueryStringValue("center", JSON.stringify(map.getCenter().toJSON()));
      }, 100)
    );

    const polylineButton = document.createElement("button");
    polylineButton.textContent = "Add Polyline";
    polylineButton.className = "map-button";

    polylineButton.onclick = (event) => {
      const rect = event.target.getBoundingClientRect();
      setButtonPosition({ top: rect.bottom, left: rect.left });
      setShowPolylineUI((prev) => !prev);
      log("Polyline button clicked");
    };

    map.controls[google.maps.ControlPosition.TOP_LEFT].push(polylineButton);
  }, []);

  useEffect(() => {
    if (!props.selectedRow) return;

    // Clear ALL route segment polylines
    polylines.forEach((polyline) => {
      if (polyline.isRouteSegment) {
        polyline.setMap(null);
      }
    });
    // Update the polylines state to remove all route segments
    setPolylines(polylines.filter((p) => !p.isRouteSegment));

    // Get the current route segment from the selected row
    const routeSegment = _.get(
      props.selectedRow,
      "request.vehicle.currentroutesegment"
    );

    if (routeSegment) {
      log("Processing new route segment polyline:", {
        rowTimestamp: props.selectedRow.timestamp,
        polyline: routeSegment,
      });

      try {
        const decodedPoints = decode(routeSegment);

        if (decodedPoints && decodedPoints.length > 0) {
          const validWaypoints = decodedPoints.map((point) => ({
            lat: point.latDegrees(),
            lng: point.lngDegrees(),
          }));

          log("Creating new polyline with", {
            points: validWaypoints.length,
            firstPoint: validWaypoints[0],
            lastPoint: validWaypoints[validWaypoints.length - 1],
          });

          const trafficRendering = _.get(
            props.selectedRow,
            "request.vehicle.currentroutesegmenttraffic.trafficrendering"
          );

          const rawLocation = _.get(
            props.selectedRow.lastlocation,
            "rawlocation"
          );

          const trafficPolyline = new TrafficPolyline({
            path: validWaypoints,
            zIndex: 2,
            trafficRendering: structuredClone(trafficRendering),
            currentLatLng: rawLocation,
            map: map,
          });
          setPolylines((prev) => [...prev, ...trafficPolyline.polylines]);
        }
      } catch (error) {
        console.error("Error processing route segment polyline:", {
          error,
          routeSegment,
          rowData: props.selectedRow,
        });
      }
    }
  }, [props.selectedRow, map]);

  const handlePolylineSubmit = (waypoints, properties) => {
    const path = waypoints.map(
      (wp) => new google.maps.LatLng(wp.latitude, wp.longitude)
    );

    const arrowIcon = {
      path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
      scale: properties.strokeWeight / 2,
      strokeColor: properties.color,
    };

    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: properties.color,
      strokeOpacity: properties.opacity,
      strokeWeight: properties.strokeWeight,
      icons: [
        {
          icon: arrowIcon,
          offset: "0%",
        },
        {
          icon: arrowIcon,
          offset: "100%",
        },
      ],
    });

    polyline.setMap(map);
    setPolylines([...polylines, polyline]);
    log(
      `Polyline ${polylines.length + 1} created with color: ${
        properties.color
      }, opacity: ${properties.opacity}, stroke weight: ${
        properties.strokeWeight
      }`
    );
  };

  /*
   * Handler for timewindow change.  Updates global min/max date globals
   * and recomputes the paths as well as all the bubble markers to respect the
   * new date values.
   *
   * Debounced to every 100ms as a blance between performance and reactivity when
   * the slider is dragged.
   */
  useEffect(() => {
    const updateMap = () => {
      minDate = new Date(props.rangeStart);
      maxDate = new Date(props.rangeEnd);
      addTripPolys(map);
      _.forEach(toggleHandlers, (handler, name) => {
        if (bubbleMap[name]) {
          handler(true);
        }
      });
    };

    // Create a debounced version of updateMap
    const debouncedUpdateMap = _.debounce(updateMap, 200);
    debouncedUpdateMap();

    // Cleanup function to cancel any pending debounced calls when the effect re-runs or unmounts
    return () => {
      debouncedUpdateMap.cancel();
    };
  }, [props.rangeStart, props.rangeEnd]);

  useEffect(() => {
    // Car location maker
    const data = props.selectedRow;
    if (!data) return;
    _.forEach(dataMakers, (m) => m.setMap(null));
    dataMakers = [];

    const markerSymbols = {
      background: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#FFFFFF",
        fillOpacity: 0.7,
        scale: 18,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
        strokeOpacity: 0.3,
      },
      chevron: {
        path: "M -1,1 L 0,-1 L 1,1 L 0,0.5 z",
        fillColor: "#4285F4",
        fillOpacity: 1,
        scale: 10,
        strokeColor: "#4285F4",
        strokeWeight: 1,
        rotation: 0,
      },
    };

    const rawLocation = _.get(data.lastlocation, "rawlocation");
    if (rawLocation) {
      const heading = _.get(data.lastlocation, "heading") || 0;
      markerSymbols.chevron.rotation = heading;

      const backgroundMarker = new window.google.maps.Marker({
        position: { lat: rawLocation.latitude, lng: rawLocation.longitude },
        map: map,
        icon: markerSymbols.background,
        clickable: false,
        zIndex: 9,
      });

      const chevronMarker = new window.google.maps.Marker({
        position: { lat: rawLocation.latitude, lng: rawLocation.longitude },
        map: map,
        icon: markerSymbols.chevron,
        zIndex: 10,
      });

      dataMakers.push(backgroundMarker, chevronMarker);
    }
  }, [props.selectedRow]);

  for (const toggle of props.toggles) {
    const id = toggle.id;
    const enabled = props.toggleOptions[id];
    useEffect(() => {
      toggleHandlers[id](enabled);
    }, [props.toggleOptions[id]]);
  }

  return (
    <>
      <div ref={ref} id="map" style={{ height: "100%", width: "100%" }} />
      {showPolylineUI && (
        <PolylineCreation
          onSubmit={handlePolylineSubmit}
          onClose={() => setShowPolylineUI(false)}
          buttonPosition={buttonPosition}
        />
      )}
    </>
  );
}

function getPolyBounds(bounds, p) {
  p.getPath().forEach((e) => {
    bounds.extend(e);
  });
  return bounds;
}

/*
 * Deterministically assign a color per trip using tripIdx
 * Colors were chosen for visibility
 */
function getColor(tripIdx) {
  const colors = [
    "#2d7dd2",
    "#97cc04",
    "#eeb902",
    "#f45d01",
    "#474647",
    "00aa00",
  ];
  return colors[tripIdx % colors.length];
}

function Map(props) {
  tripLogs = props.logData.tripLogs;
  taskLogs = props.logData.taskLogs;
  minDate = props.rangeStart;
  maxDate = props.rangeEnd;
  const urlParams = new URLSearchParams(window.location.search);
  apikey = urlParams.get("apikey") || props.logData.apikey;
  mapId = urlParams.get("mapId") || props.logData.mapId;
  jwt = props.logData.jwt;
  projectId = props.logData.projectId;
  solutionType = props.logData.solutionType;
  setFeaturedObject = props.setFeaturedObject;
  setTimeRange = props.setTimeRange;

  function centerOnLocation(lat, lng) {
    if (map) {
      const newCenter = new google.maps.LatLng(lat, lng);
      map.setCenter(newCenter);
      map.setZoom(13);
      console.log(`Map centered on: ${lat}, ${lng}`);
    } else {
      console.error("Map not initialized");
    }
  }

  props.setCenterOnLocation(centerOnLocation);

  return (
    <Wrapper
      apiKey={apikey}
      render={render}
      version="beta"
      libraries={["geometry", "journeySharing"]}
    >
      <MyMapComponent
        rangeStart={props.rangeStart}
        rangeEnd={props.rangeEnd}
        selectedRow={props.selectedRow}
        toggles={props.toggles}
        toggleOptions={props.toggleOptions}
      />
    </Wrapper>
  );
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
      bubbleMap[bubbleName] = tripLogs
        .getLogs_(minDate, maxDate)
        .map((le) => {
          const lastLocation = le.lastlocation;
          let rawlocation;
          let bubble = undefined;
          if (lastLocation && (rawlocation = lastLocation.rawlocation)) {
            bubble = cb(
              new google.maps.LatLng({
                lat: rawlocation.latitude,
                lng: rawlocation.longitude,
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
  (rawLocationLatLng, lastLocation) => {
    let color;
    switch (lastLocation.locationsensor) {
      case "GPS":
        color = "#11FF11";
        break;
      case "NETWORK":
        color = "#FF1111";
        break;
      case "PASSIVE":
        color = "#FF0000";
        break;
      case "ROAD_SNAPPED_LOCATION_PROVIDER":
        color = "#00FF00";
        break;
      case "FUSED_LOCATION_PROVIDER":
        color = "#11FF11";
        break;
      case "LOG_UNSPECIFIED":
      default:
        color = "#000000";
    }
    const accuracy = lastLocation.rawlocationaccuracy;
    if (accuracy) {
      let circ = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.2,
        map,
        center: rawLocationLatLng,
        radius: accuracy, // units is this actually meters?
      });
      google.maps.event.addListener(circ, "mouseover", () => {
        setFeaturedObject({
          rawlocationaccuracy: lastLocation.rawlocationaccuracy,
          locationsensor: lastLocation.locationsensor,
        });
      });
      return circ;
    }
  }
);

/*
 * Draws circles on map with a radius equal to the
 * time delta (1 meter radius = 1 second of delta)
 */
toggleHandlers["showClientServerTimeDeltas"] = GenerateBubbles(
  "showClientServerTimeDeltas",
  (rawLocationLatLng, lastLocation, logEntry) => {
    const clientTimeStr = _.get(
      logEntry.lastlocationResponse,
      "rawlocationtime"
    );
    const serverTimeStr = _.get(logEntry.lastlocationResponse, "servertime");
    if (clientTimeStr && serverTimeStr) {
      const clientDate = new Date(clientTimeStr);
      const serverDate = new Date(serverTimeStr);
      const timeDeltaSeconds =
        Math.abs(clientDate.getTime() - serverDate.getTime()) / 1000;
      let color;
      if (clientDate > serverDate) {
        color = "#0000F0";
      } else {
        color = "#0F0000";
      }

      let circ = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.6,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.2,
        map,
        center: rawLocationLatLng,
        radius: timeDeltaSeconds,
      });
      google.maps.event.addListener(circ, "mouseover", () => {
        setFeaturedObject({
          timeDeltaSeconds: timeDeltaSeconds,
          serverDate: serverDate,
          clientDate: clientDate,
        });
      });
      return circ;
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
    const heading = _.get(logEntry.lastlocation, "heading");
    const accuracy = _.get(logEntry.lastlocation, "headingaccuracy");

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
      // TODO: allow updating panorama based on forward/back
      // stepper buttons (ie at each updatevehicle log we have a heading)
      panorama = new google.maps.StreetViewPanorama(
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
      console.log("loaded panorama", panorama);
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
  (rawLocationLatLng, lastLocation) => {
    const speed = lastLocation.speed;
    if (lastLocation.speed === undefined) {
      return;
    }
    const color = speed < 0 ? "#FF0000" : "#00FF00";
    return new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.5,
      fillColor: color,
      fillOpacity: 0.5,
      map,
      center: rawLocationLatLng,
      radius: Math.abs(speed),
    });
  }
);

/*
 * Draws circles on the map. Color indicates trip status
 * at that location.   Note that trip status isn't actually
 * in the update vehicle logs, so current trip status will actually
 * just be the trip status at the time of the vehicle update  --
 * which is a bit wrong and wonky on the boundaries.
 */
toggleHandlers["showTripStatus"] = GenerateBubbles(
  "showTripStatus",
  (rawLocationLatLng, lastLocation, le) => {
    let color,
      radius = 5;
    const tripStatus = tripLogs.getTripStatusAtDate(le.date);
    switch (tripStatus) {
      case "NEW":
        color = "#002200";
        radius = 30;
        break;
      case "ENROUTE_TO_PICKUP":
        color = "#FFFF00";
        break;
      case "ARRIVED_AT_PICKUP":
        color = "#FFFF10";
        radius = 10;
        break;
      case "ARRIVED_AT_INTERMEDIATE_DESTINATION":
        color = "#10FFFF";
        radius = 20;
        break;
      case "ENROUTE_TO_DROPOFF":
        color = "#00FFFF";
        break;
      case "COMPLETE":
        radius = 30;
        color = "#00FF00";
        break;
      case "CANCELED":
        radius = 30;
        color = "#FF0000";
        break;
      case "UNKNOWN_TRIP_STATUS":
      default:
        color = "#000000";
    }

    const statusCirc = new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.5,
      fillColor: color,
      fillOpacity: 0.5,
      map,
      center: rawLocationLatLng,
      radius: radius, // set based on trip status?
    });
    google.maps.event.addListener(statusCirc, "mouseover", () => {
      setFeaturedObject({
        tripStatus: tripStatus,
      });
    });
    return statusCirc;
  }
);

/*
 * Enable/disables live traffic layer
 */
toggleHandlers["showTraffic"] = function (enabled) {
  if (!trafficLayer) {
    trafficLayer = new google.maps.TrafficLayer();
  }
  if (enabled) {
    trafficLayer.setMap(map);
  } else {
    trafficLayer.setMap(null);
  }
};

/*
 * Draws circles on the map. Size indicates dwell time at that
 * location.
 */
toggleHandlers["showDwellLocations"] = function (enabled) {
  const bubbleName = "showDwellLocations";
  const dwellLocations = tripLogs.getDwellLocations(minDate, maxDate);
  _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
  delete bubbleMap[bubbleName];
  if (enabled) {
    bubbleMap[bubbleName] = _.map(dwellLocations, (dl) => {
      const circ = new google.maps.Circle({
        strokeColor: "#000000",
        strokeOpacity: 0.25,
        fillColor: "#FFFF00",
        fillOpacity: 0.25,
        map,
        center: dl.leaderCoords,
        radius: dl.updates * 3, // make dwell times more obvious
      });
      google.maps.event.addListener(circ, "mouseover", () => {
        setFeaturedObject({
          startDate: dl.startDate,
          duration: Utils.formatDuration(dl.endDate - dl.startDate),
          endDate: dl.endDate,
        });
      });
      return circ;
    });
  }
};

/*
 * Draws markers on the map for all tasks.
 */
toggleHandlers["showTasksAsCreated"] = function (enabled) {
  const bubbleName = "showTasksAsCreated";
  const tasks = taskLogs.getTasks(maxDate).value();
  _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
  delete bubbleMap[bubbleName];
  function getIcon(task) {
    const outcome = task.taskoutcome || "unknown";
    const urlBase = "http://maps.google.com/mapfiles/kml/shapes/";
    const icon = {
      url: urlBase,
      scaledSize: new google.maps.Size(35, 35),
    };
    if (outcome.match("SUCCEEDED")) {
      icon.url += "flag.png";
    } else if (outcome.match("FAIL")) {
      icon.url += "caution.png";
    } else {
      icon.url += "shaded_dot.png";
    }
    return icon;
  }
  if (enabled) {
    bubbleMap[bubbleName] = _(tasks)
      .map((task) => {
        const marker = new window.google.maps.Marker({
          position: {
            lat: task.plannedlocation.point.latitude,
            lng: task.plannedlocation.point.longitude,
          },
          map: map,
          icon: getIcon(task),
          title: `${task.state}: ${task.taskid} - ${task.trackingid}`,
        });
        google.maps.event.addListener(marker, "click", () => {
          setFeaturedObject(task);
        });
        const ret = [marker];
        const arrowColor =
          task.plannedVsActualDeltaMeters > 50 ? "#FF1111" : "#11FF11";
        if (task.taskoutcomelocation) {
          const offSetPath = new window.google.maps.Polyline({
            path: [
              {
                lat: task.plannedlocation.point.latitude,
                lng: task.plannedlocation.point.longitude,
              },
              {
                lat: task.taskoutcomelocation.point.latitude,
                lng: task.taskoutcomelocation.point.longitude,
              },
            ],
            geodesic: true,
            strokeColor: arrowColor,
            strokeOpacity: 0.6,
            strokeWeight: 4,
            map: map,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  strokeColor: arrowColor,
                  strokeWeight: 4,
                },
                offset: "100%",
              },
            ],
          });
          ret.push(offSetPath);
        }
        return ret;
      })
      .flatten()
      .value();
  }
};

/*
 * Draws planned paths on the map.
 */
toggleHandlers["showPlannedPaths"] = function (enabled) {
  const bubbleName = "showPlannedPaths";
  _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
  delete bubbleMap[bubbleName];

  if (enabled) {
    const trips = tripLogs.getTrips();
    bubbleMap[bubbleName] = trips
      .filter((trip) => {
        return (
          trip.firstUpdate <= maxDate &&
          trip.lastUpdate >= minDate &&
          trip.getPlannedPath().length > 0
        );
      })
      .map((trip) => {
        const plannedPath = trip.getPlannedPath();
        const path = new window.google.maps.Polyline({
          path: plannedPath,
          geodesic: true,
          strokeColor: getColor(trip.tripIdx),
          strokeOpacity: 0.3,
          strokeWeight: 6,
        });
        path.setMap(map);
        return path;
      });
  }
};

/*
 * Draws circles on the map. Size indicates dwell time at that
 * location.
 */
toggleHandlers["showNavStatus"] = GenerateBubbles(
  "showNavStatus",
  (rawLocationLatLng, lastLocation, le) => {
    const navStatus = le.navStatus;
    if (navStatus === undefined) {
      return;
    }
    let color,
      radius = 5;
    switch (navStatus) {
      case "UNKNOWN_NAVIGATION_STATUS":
        color = "#222222";
        break;
      case "NO_GUIDANCE":
        color = "#090909";
        break;
      case "ENROUTE_TO_DESTINATION":
        color = "#00FF00";
        break;
      case "OFF_ROUTE":
        color = "#FF0000";
        radius = 30;
        break;
      case "ARRIVED_AT_DESTINATION":
        color = "0000FF";
        radius = 10;
        break;
      default:
        color = "#000000";
    }
    const statusCirc = new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.5,
      fillColor: color,
      fillOpacity: 0.5,
      map,
      center: rawLocationLatLng,
      radius: radius, // set based on trip status?
    });
    google.maps.event.addListener(statusCirc, "mouseover", () => {
      setFeaturedObject({
        navStatus: navStatus,
        vehicleState: _.get(le, "response.vehiclestate"),
        tripStatus: "??",
      });
    });
    return statusCirc;
  }
);

/*
 * Draws circles on the map. Size indicates delta in seconds at that
 * location.
 */
toggleHandlers["showETADeltas"] = function (enabled) {
  const bubbleName = "showETADeltas";
  _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
  delete bubbleMap[bubbleName];
  const etaDeltas = tripLogs.getETADeltas(minDate, maxDate);
  if (enabled) {
    bubbleMap[bubbleName] = _.map(etaDeltas, (etaDelta) => {
      const circ = new google.maps.Circle({
        strokeColor: "#000000",
        strokeOpacity: 0.25,
        fillColor: "FF0000",
        fillOpacity: 0.25,
        map,
        center: etaDelta.coords,
        // cap radius to 300 meters to avoid coloring the whole
        // screen when there is a very large delta.  Definitely
        // needs tuning ... and likely better to consider adjusting
        // color as well.
        radius: _.min([etaDelta.deltaInSeconds, 300]),
      });
      google.maps.event.addListener(circ, "mouseover", () => {
        setFeaturedObject({
          etaDeltaInSeconds: etaDelta.deltaInSeconds,
        });
      });
      return circ;
    });
  }
};

/*
 * Draws arrows on the map showing where a vehicle jumped
 * from one location to another at an unrealistic velocity.
 */
toggleHandlers["showHighVelocityJumps"] = function (enabled) {
  const bubbleName = "showHighVelocityJumps";

  tripLogs.debouncedGetHighVelocityJumps(minDate, maxDate, (jumps) => {
    _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
    delete bubbleMap[bubbleName];

    if (enabled) {
      bubbleMap[bubbleName] = _(jumps)
        .map((jump) => {
          function getStrokeWeight(velocity) {
            if (velocity <= 100) {
              return 2;
            } else if (velocity < 1000) {
              return 6;
            } else if (velocity < 2000) {
              return 10;
            } else {
              return 14;
            }
          }
          const path = new window.google.maps.Polyline({
            path: [jump.startLoc, jump.endLoc],
            geodesic: true,
            strokeColor: getColor(jump.jumpIdx),
            strokeOpacity: 0.8,
            strokeWeight: getStrokeWeight(jump.velocity),
            map: map,
            icons: [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  strokeColor: getColor(jump.jumpIdx),
                  strokeWeight: getStrokeWeight(jump.velocity),
                },
                offset: "100%",
              },
            ],
          });
          google.maps.event.addListener(path, "mouseover", () => {
            setFeaturedObject(jump.getFeaturedData());
          });
          google.maps.event.addListener(path, "click", () => {
            setFeaturedObject(jump.getFeaturedData());
            // show a minute +/- on each side of a jump
            setTimeRange(
              jump.startDate.getTime() - 60 * 1000,
              jump.endDate.getTime() + 60 * 1000
            );
          });
          return [path];
        })
        .flatten()
        .value();
    } else {
      console.log("Disabling high velocity jumps");
      setTimeRange(tripLogs.minDate.getTime(), tripLogs.maxDate.getTime());
    }
  });
};

/*
 * Marks locations on the map where we did not get the expected
 * updateVehicle requests
 */
toggleHandlers["showMissingUpdates"] = function (enabled) {
  const bubbleName = "showMissingUpdates";
  const missingUpdates = tripLogs.getMissingUpdates(minDate, maxDate);
  _.forEach(bubbleMap[bubbleName], (bubble) => bubble.setMap(null));
  delete bubbleMap[bubbleName];
  if (enabled) {
    bubbleMap[bubbleName] = _(missingUpdates)
      .map((update) => {
        function getStrokeWeight(interval) {
          if (interval <= 60 * 1000) {
            return 2;
          } else if (interval < 60 * 10 * 1000) {
            return 6;
          } else if (interval < 60 * 60 * 10 * 1000) {
            return 10;
          } else {
            return 14;
          }
        }
        const heading = google.maps.geometry.spherical.computeHeading(
          update.startLoc,
          update.endLoc
        );
        const offsetHeading = ((heading + 360 + 90) % 360) - 180;
        const points = [
          update.startLoc,
          google.maps.geometry.spherical.computeOffset(
            update.startLoc,
            1000, //TODO compute based on viewport?
            offsetHeading
          ),
          google.maps.geometry.spherical.computeOffset(
            update.startLoc,
            900, //TODO compute based on viewport?
            offsetHeading
          ),
          google.maps.geometry.spherical.computeOffset(
            update.endLoc,
            900, //TODO compute based on viewport?
            offsetHeading
          ),
          google.maps.geometry.spherical.computeOffset(
            update.endLoc,
            1000, //TODO compute based on viewport?
            offsetHeading
          ),
          update.endLoc,
        ];
        const path = new window.google.maps.Polyline({
          path: points,
          geodesic: true,
          strokeColor: "#008B8B",
          strokeOpacity: 0.5,
          strokeWeight: getStrokeWeight(update.interval),
          map: map,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                strokeColor: "#008B8B",
                strokeWeight: getStrokeWeight(update.interval),
                scale: 6,
              },
              offset: "50%",
            },
            {
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                strokeColor: "#000000",
                strokeWeight: 1,
                strokeOpacity: 0.5,
              },
              offset: "0%",
            },
            {
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                strokeColor: "#000000",
                strokeWeight: 1,
                strokeOpacity: 0.5,
              },
              offset: "100%",
            },
          ],
        });
        google.maps.event.addListener(path, "mouseover", () => {
          setFeaturedObject(update.getFeaturedData());
          path.setOptions({
            strokeOpacity: 1,
            strokeWeight: 1.5 * getStrokeWeight(update.interval),
          });
        });
        google.maps.event.addListener(path, "mouseout", () => {
          path.setOptions({
            strokeOpacity: 0.5,
            strokeWeight: getStrokeWeight(update.interval),
          });
        });
        google.maps.event.addListener(path, "click", () => {
          setFeaturedObject(update.getFeaturedData());
          // show a minute +/- on each side of a update
          setTimeRange(
            update.startDate.getTime() - 60 * 1000,
            update.endDate.getTime() + 60 * 1000
          );
        });
        return [path];
      })
      .flatten()
      .value();
  } else {
    // TODO: ideally reset to timerange that was selected before enabling
    // jump view
    setTimeRange(tripLogs.minDate.getTime(), tripLogs.maxDate.getTime());
  }
};

/*
 * Enable/disables live journey sharing view
 */
toggleHandlers["showLiveJS"] = function (enabled) {
  if (!jwt) {
    console.log("Issue #25 -- no/invalid jwt");
    return;
  }
  // call into js to set the trip
  if (enabled) {
    locationProvider.tripId = _.last(tripLogs.getTripIDs());
  } else {
    locationProvider.tripId = "";
  }
};

export { Map as default };
