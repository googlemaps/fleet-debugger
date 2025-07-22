// src/MapToggles.js
import _ from "lodash";
import { getColor } from "./Trip";
import Utils, { log } from "./Utils";

export const ALL_TOGGLES = [
  {
    id: "showGPSBubbles",
    name: "GPS Accuracy",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/GPSAccuracy.md",
    columns: ["lastlocation.rawlocationaccuracy", "lastlocation.locationsensor"],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showHeading",
    name: "Heading",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Heading.md",
    columns: ["lastlocation.heading", "lastlocation.headingaccuracy"],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showSpeed",
    name: "Speed",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Speed.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showTripStatus",
    name: "Trip Status",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/TripStatus.md",
    columns: [],
    solutionTypes: ["ODRD"],
  },
  {
    id: "showNavStatus",
    name: "Navigation Status",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/NavStatus.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showTasksAsCreated",
    name: "Tasks",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Tasks.md",
    columns: [],
    solutionTypes: ["LMFS"],
  },
  {
    id: "showPlannedPaths",
    name: "Planned Paths",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/PlannedPaths.md",
    columns: [],
    solutionTypes: ["LMFS"],
  },
  {
    id: "showDwellLocations",
    name: "Dwell Locations",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/DwellTimes.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showHighVelocityJumps",
    name: "Jumps (unrealistic velocity)",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/VelocityJumps.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showMissingUpdates",
    name: "Jumps (Temporal)",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/MissingUpdates.md",
    columns: ["temporal_gap"],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showClientServerTimeDeltas",
    name: "Client/Server Time Deltas",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showETADeltas",
    name: "ETA Deltas",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/EtaDeltas.md",
    columns: ["request.vehicle.etatofirstwaypoint"],
    solutionTypes: ["ODRD"],
  },
  {
    id: "showTraffic",
    name: "Live Traffic",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
  {
    id: "showLiveJS",
    name: "Live Journey Sharing",
    docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
    columns: [],
    solutionTypes: ["ODRD", "LMFS"],
  },
];

export function getVisibleToggles(solutionType) {
  if (!solutionType) return [];
  log(`Filtering toggles for solution type: ${solutionType}`);
  return _.filter(ALL_TOGGLES, (toggle) => toggle.solutionTypes.indexOf(solutionType) !== -1);
}

export function getToggleHandlers({
  map,
  tripLogs,
  taskLogs,
  minDate,
  maxDate,
  setFeaturedObject,
  setTimeRange,
  bubbleMapRef,
  panoramaRef,
  mapDivRef,
  trafficLayerRef,
  locationProviderRef,
  jwt,
}) {
  const GenerateBubbles = (bubbleName, cb) => (showBubble) => {
    _.forEach(bubbleMapRef.current[bubbleName], (bubble) => bubble.setMap(null));
    delete bubbleMapRef.current[bubbleName];
    if (showBubble) {
      log(`Enabling ${bubbleName}`);
      bubbleMapRef.current[bubbleName] = tripLogs
        .getLogs_(minDate, maxDate)
        .map((le) => {
          const rawloc = le.lastlocation?.rawlocation;
          if (rawloc && typeof rawloc.latitude === "number" && typeof rawloc.longitude === "number") {
            const latLng = new window.google.maps.LatLng(rawloc.latitude, rawloc.longitude);
            return cb(latLng, le.lastlocation, le);
          }
          return null;
        })
        .compact()
        .value();
    }
  };

  return {
    showGPSBubbles: GenerateBubbles("showGPSBubbles", (rawLocationLatLng, lastLocation) => {
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
        const circ = new window.google.maps.Circle({
          strokeColor: color,
          strokeOpacity: 0.6,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.2,
          map,
          center: rawLocationLatLng,
          radius: accuracy,
        });
        window.google.maps.event.addListener(circ, "mouseover", () => {
          setFeaturedObject({
            rawlocationaccuracy: lastLocation.rawlocationaccuracy,
            locationsensor: lastLocation.locationsensor,
          });
        });
        return circ;
      }
    }),
    showClientServerTimeDeltas: GenerateBubbles(
      "showClientServerTimeDeltas",
      (rawLocationLatLng, lastLocation, logEntry) => {
        const clientTimeStr = _.get(logEntry.lastlocationResponse, "rawlocationtime");
        const serverTimeStr = _.get(logEntry.lastlocationResponse, "servertime");
        if (clientTimeStr && serverTimeStr) {
          const clientDate = new Date(clientTimeStr);
          const serverDate = new Date(serverTimeStr);
          const timeDeltaSeconds = Math.abs(clientDate.getTime() - serverDate.getTime()) / 1000;
          let color = clientDate > serverDate ? "#0000F0" : "#0F0000";

          const circ = new window.google.maps.Circle({
            strokeColor: color,
            strokeOpacity: 0.6,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.2,
            map,
            center: rawLocationLatLng,
            radius: timeDeltaSeconds,
          });
          window.google.maps.event.addListener(circ, "mouseover", () => {
            setFeaturedObject({
              timeDeltaSeconds: timeDeltaSeconds,
              serverDate: serverDate,
              clientDate: clientDate,
            });
          });
          return circ;
        }
      }
    ),
    showHeading: GenerateBubbles("showHeading", (rawLocationLatLng, lastLocation, logEntry) => {
      const heading = _.get(logEntry.lastlocation, "heading");
      const accuracy = _.get(logEntry.lastlocation, "headingaccuracy");
      if (heading === undefined || accuracy === undefined) {
        return;
      }
      const headingLine = new window.google.maps.Polyline({
        strokeColor: "#0000F0",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        icons: [
          {
            icon: {
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              strokeColor: "#0000FF",
              strokeWeight: 4,
            },
            offset: "100%",
          },
        ],
        map,
        path: [rawLocationLatLng, window.google.maps.geometry.spherical.computeOffset(rawLocationLatLng, 20, heading)],
      });
      headingLine.addListener("click", () => {
        log("Heading line clicked, showing StreetView.");
        panoramaRef.current = new window.google.maps.StreetViewPanorama(mapDivRef.current, {
          position: rawLocationLatLng,
          pov: { heading, pitch: 10 },
        });
      });
      return headingLine;
    }),
    showSpeed: GenerateBubbles("showSpeed", (rawLocationLatLng, lastLocation) => {
      const speed = lastLocation.speed;
      if (speed === undefined) {
        return;
      }
      const color = speed < 0 ? "#FF0000" : "#00FF00";
      return new window.google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.5,
        fillColor: color,
        fillOpacity: 0.5,
        map,
        center: rawLocationLatLng,
        radius: Math.abs(speed),
      });
    }),
    showTripStatus: GenerateBubbles("showTripStatus", (rawLocationLatLng, lastLocation, le) => {
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

      const statusCirc = new window.google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.5,
        fillColor: color,
        fillOpacity: 0.5,
        map,
        center: rawLocationLatLng,
        radius: radius,
      });
      window.google.maps.event.addListener(statusCirc, "mouseover", () => {
        setFeaturedObject({
          tripStatus: tripStatus,
        });
      });
      return statusCirc;
    }),
    showNavStatus: GenerateBubbles("showNavStatus", (rawLocationLatLng, lastLocation, le) => {
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
          color = "#0000FF";
          radius = 10;
          break;
        default:
          color = "#000000";
      }
      const statusCirc = new window.google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.5,
        fillColor: color,
        fillOpacity: 0.5,
        map,
        center: rawLocationLatLng,
        radius: radius,
      });
      window.google.maps.event.addListener(statusCirc, "mouseover", () => {
        setFeaturedObject({
          navStatus: navStatus,
        });
      });
      return statusCirc;
    }),
    showTraffic: (enabled) => {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
      }
      if (enabled) {
        log("Enabling Traffic");
        trafficLayerRef.current.setMap(map);
      } else {
        log("Disabling Traffic");
        trafficLayerRef.current.setMap(null);
      }
    },
    showLiveJS: (enabled) => {
      if (!jwt) {
        log("Cannot enable LiveJS: JWT is missing.");
        return;
      }
      if (enabled) {
        log("Enabling LiveJS");
        locationProviderRef.current.tripId = _.last(tripLogs.getTripIDs());
      } else {
        log("Disabling LiveJS");
        locationProviderRef.current.tripId = "";
      }
    },
    showDwellLocations: (enabled) => {
      const bubbleName = "showDwellLocations";
      _.forEach(bubbleMapRef.current[bubbleName], (bubble) => bubble.setMap(null));
      delete bubbleMapRef.current[bubbleName];

      if (enabled) {
        log(`Enabling ${bubbleName}`);
        bubbleMapRef.current[bubbleName] = _.map(tripLogs.getDwellLocations(minDate, maxDate), (dl) => {
          const circ = new window.google.maps.Circle({
            strokeColor: "#000000",
            strokeOpacity: 0.25,
            fillColor: "#FFFF00",
            fillOpacity: 0.25,
            map,
            center: dl.leaderCoords,
            radius: dl.updates * 3,
          });
          window.google.maps.event.addListener(circ, "mouseover", () => {
            setFeaturedObject({
              startDate: dl.startDate,
              duration: Utils.formatDuration(dl.endDate - dl.startDate),
              endDate: dl.endDate,
            });
          });
          return circ;
        });
      }
    },
    showTasksAsCreated: (enabled) => {
      const bubbleName = "showTasksAsCreated";
      _.forEach(bubbleMapRef.current[bubbleName], (b) => b.setMap(null));
      delete bubbleMapRef.current[bubbleName];
      if (enabled) {
        log(`Enabling ${bubbleName}`);
        bubbleMapRef.current[bubbleName] = _.map(
          taskLogs.getTasks(maxDate).value(),
          (t) => new window.google.maps.Marker({ map, position: t.plannedlocation.point })
        );
      }
    },
    showPlannedPaths: (enabled) => {
      const bubbleName = "showPlannedPaths";
      _.forEach(bubbleMapRef.current[bubbleName], (b) => b.setMap(null));
      delete bubbleMapRef.current[bubbleName];
      if (enabled) {
        log(`Enabling ${bubbleName}`);
        bubbleMapRef.current[bubbleName] = tripLogs
          .getTrips()
          .filter((t) => t.getPlannedPath().length > 0)
          .map(
            (t) => new window.google.maps.Polyline({ map, path: t.getPlannedPath(), strokeColor: getColor(t.tripIdx) })
          );
      }
    },
    showETADeltas: (enabled) => {
      const bubbleName = "showETADeltas";
      _.forEach(bubbleMapRef.current[bubbleName], (b) => b.setMap(null));
      delete bubbleMapRef.current[bubbleName];
      if (enabled) {
        log(`Enabling ${bubbleName}`);
        bubbleMapRef.current[bubbleName] = _.map(tripLogs.getETADeltas(minDate, maxDate), (d) => {
          const circ = new window.google.maps.Circle({
            map,
            center: d.coords,
            radius: _.min([d.deltaInSeconds, 300]),
            strokeColor: "#000000",
            strokeOpacity: 0.25,
            fillColor: "#FF0000",
            fillOpacity: 0.25,
          });
          window.google.maps.event.addListener(circ, "mouseover", () => {
            setFeaturedObject({
              etaDeltaInSeconds: d.deltaInSeconds,
            });
          });
          return circ;
        });
      }
    },
    showHighVelocityJumps: (enabled) => {
      const bubbleName = "showHighVelocityJumps";
      tripLogs.debouncedGetHighVelocityJumps(minDate, maxDate, (jumps) => {
        _.forEach(bubbleMapRef.current[bubbleName], (b) => b.setMap(null));
        delete bubbleMapRef.current[bubbleName];
        if (enabled) {
          log(`Enabling ${bubbleName}`);
          bubbleMapRef.current[bubbleName] = _(jumps)
            .map((jump) => {
              const getStrokeWeight = (velocity) =>
                velocity <= 100 ? 2 : velocity < 1000 ? 6 : velocity < 2000 ? 10 : 14;
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
                      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      strokeColor: getColor(jump.jumpIdx),
                      strokeWeight: getStrokeWeight(jump.velocity),
                    },
                    offset: "100%",
                  },
                ],
              });
              path.addListener("mouseover", () => setFeaturedObject(jump.getFeaturedData()));
              path.addListener("click", () => {
                setFeaturedObject(jump.getFeaturedData());
                setTimeRange(jump.startDate.getTime() - 60 * 1000, jump.endDate.getTime() + 60 * 1000);
              });
              return [path];
            })
            .flatten()
            .value();
        }
      });
    },
    showMissingUpdates: (enabled) => {
      const bubbleName = "showMissingUpdates";
      _.forEach(bubbleMapRef.current[bubbleName], (b) => b.setMap(null));
      delete bubbleMapRef.current[bubbleName];
      if (enabled) {
        log(`Enabling ${bubbleName}`);
        bubbleMapRef.current[bubbleName] = _(tripLogs.getMissingUpdates(minDate, maxDate))
          .map((update) => {
            const getStrokeWeight = (interval) =>
              interval <= 60000 ? 2 : interval < 600000 ? 6 : interval < 36000000 ? 10 : 14;
            const heading = window.google.maps.geometry.spherical.computeHeading(update.startLoc, update.endLoc);
            const offsetHeading = ((heading + 360 + 90) % 360) - 180;
            const points = [
              update.startLoc,
              window.google.maps.geometry.spherical.computeOffset(update.startLoc, 1000, offsetHeading),
              window.google.maps.geometry.spherical.computeOffset(update.startLoc, 900, offsetHeading),
              window.google.maps.geometry.spherical.computeOffset(update.endLoc, 900, offsetHeading),
              window.google.maps.geometry.spherical.computeOffset(update.endLoc, 1000, offsetHeading),
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
                    path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                    strokeColor: "#008B8B",
                    strokeWeight: getStrokeWeight(update.interval),
                    scale: 6,
                  },
                  offset: "50%",
                },
                {
                  icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    strokeColor: "#000000",
                    strokeWeight: 1,
                    strokeOpacity: 0.5,
                  },
                  offset: "0%",
                },
                {
                  icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    strokeColor: "#000000",
                    strokeWeight: 1,
                    strokeOpacity: 0.5,
                  },
                  offset: "100%",
                },
              ],
            });
            path.addListener("mouseover", () => {
              setFeaturedObject(update.getFeaturedData());
              path.setOptions({ strokeOpacity: 1, strokeWeight: 1.5 * getStrokeWeight(update.interval) });
            });
            path.addListener("mouseout", () =>
              path.setOptions({ strokeOpacity: 0.5, strokeWeight: getStrokeWeight(update.interval) })
            );
            path.addListener("click", () => {
              setFeaturedObject(update.getFeaturedData());
              setTimeRange(update.startDate.getTime() - 60 * 1000, update.endDate.getTime() + 60 * 1000);
            });
            return [path];
          })
          .flatten()
          .value();
      }
    },
  };
}
