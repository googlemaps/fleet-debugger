// src/Map.js
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import _ from "lodash";
import { getQueryStringValue, setQueryStringValue } from "./queryString";
import { log } from "./Utils";
import PolylineCreation from "./PolylineCreation";
import { decode } from "s2polyline-ts";
import TrafficPolyline from "./TrafficPolyline";
import { TripObjects } from "./TripObjects";
import { getToggleHandlers } from "./MapToggles.js";

function MapComponent({
  logData,
  rangeStart,
  rangeEnd,
  selectedRow,
  toggles,
  toggleOptions,
  setFeaturedObject,
  setTimeRange,
  focusSelectedRow,
  initialMapBounds,
  setCenterOnLocation,
  setRenderMarkerOnMap,
}) {
  const { tripLogs, taskLogs, jwt, projectId, mapId } = logData;

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const locationProviderRef = useRef(null);
  const bubbleMapRef = useRef({});
  const trafficLayerRef = useRef(null);
  const vehicleMarkersRef = useRef({});
  const trafficPolylinesRef = useRef([]);
  const panoramaRef = useRef(null);
  const dynamicMarkersRef = useRef([]);

  const [showPolylineUI, setShowPolylineUI] = useState(false);
  const [_polylines, setPolylines] = useState([]);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });
  const [isFollowingVehicle, setIsFollowingVehicle] = useState(false);
  const lastValidPositionRef = useRef(null);

  const minDate = useMemo(() => new Date(rangeStart), [rangeStart]);
  const maxDate = useMemo(() => new Date(rangeEnd), [rangeEnd]);

  const updateDynamicMarker = useCallback((location, color, shouldAdd) => {
    const map = mapRef.current;
    if (!map) {
      console.error("Map not available to update dynamic marker.");
      return;
    }

    const existingMarkerIndex = dynamicMarkersRef.current.findIndex(
      (m) => m.locationData && _.isEqual(m.locationData, location)
    );

    if (shouldAdd && existingMarkerIndex === -1) {
      log(`Map.js: Adding dynamic marker at ${JSON.stringify(location)} with color ${color}`);
      const marker = new window.google.maps.Marker({
        position: location,
        map,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 0,
          anchor: new window.google.maps.Point(12, 22),
          scale: 0.8,
        },
        zIndex: 100,
      });
      marker.locationData = location;
      dynamicMarkersRef.current.push(marker);
    } else if (!shouldAdd && existingMarkerIndex > -1) {
      log(`Map.js: Removing dynamic marker at ${JSON.stringify(location)}`);
      const markerToRemove = dynamicMarkersRef.current[existingMarkerIndex];
      markerToRemove.setMap(null);
      dynamicMarkersRef.current.splice(existingMarkerIndex, 1);
    }
  }, []);

  useEffect(() => {
    if (setRenderMarkerOnMap) {
      setRenderMarkerOnMap(updateDynamicMarker);
    }
  }, [setRenderMarkerOnMap, updateDynamicMarker]);

  // Effect for map initialization (runs once on mount)
  useEffect(() => {
    if (!mapDivRef.current) return;
    log("Map.js: Initialization useEffect triggered.");

    const authTokenFetcher = (options) => {
      log("Ignoring options; using pre-built JWT.", options);
      return { token: jwt };
    };

    locationProviderRef.current = new window.google.maps.journeySharing.FleetEngineTripLocationProvider({
      projectId,
      authTokenFetcher,
    });

    const jsMapView = new window.google.maps.journeySharing.JourneySharingMapView({
      element: mapDivRef.current,
      locationProviders: [locationProviderRef.current],
      mapOptions: { mapId, mapTypeControl: true, streetViewControl: true },
    });
    const map = jsMapView.map;
    mapRef.current = map;

    const tripObjects = new TripObjects({ map, setFeaturedObject, setTimeRange });

    const addTripPolys = () => {
      const trips = tripLogs.getTrips();
      const vehicleBounds = new window.google.maps.LatLngBounds();
      _.forEach(trips, (trip) => {
        tripObjects.addTripVisuals(trip, minDate, maxDate);
        const tripCoords = trip.getPathCoords(minDate, maxDate);
        if (tripCoords.length > 0) {
          tripCoords.forEach((coord) => vehicleBounds.extend(coord));
        }
      });
      return vehicleBounds;
    };

    // Set initial view
    const urlZoom = getQueryStringValue("zoom");
    const urlCenter = getQueryStringValue("center");
    if (urlZoom && urlCenter) {
      map.setZoom(parseInt(urlZoom));
      map.setCenter(JSON.parse(urlCenter));
      addTripPolys();
    } else if (initialMapBounds) {
      const { north, south, east, west } = initialMapBounds;
      const bounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(south, west),
        new window.google.maps.LatLng(north, east)
      );
      map.fitBounds(bounds);
      addTripPolys();
    } else {
      const vehicleBounds = addTripPolys();
      if (!vehicleBounds.isEmpty()) {
        map.fitBounds(vehicleBounds);
      } else {
        map.setCenter({ lat: 20, lng: 0 });
        map.setZoom(2);
      }
    }

    // Add UI Controls
    const polylineButton = document.createElement("button");
    polylineButton.textContent = "Add Polyline";
    polylineButton.className = "map-button";
    polylineButton.onclick = (event) => {
      log("Add Polyline button clicked.");
      const rect = event.target.getBoundingClientRect();
      setButtonPosition({ top: rect.bottom, left: rect.left });
      setShowPolylineUI((prev) => !prev);
    };
    map.controls[window.google.maps.ControlPosition.TOP_LEFT].push(polylineButton);

    const followButton = document.createElement("div");
    followButton.className = "follow-vehicle-button";
    followButton.innerHTML = `<div class="follow-vehicle-background"></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20" width="24" height="24" class="follow-vehicle-chevron"><path d="M -10,10 L 0,-10 L 10,10 L 0,5 z" fill="#4285F4" stroke="#4285F4" stroke-width="1"/></svg>`;
    followButton.onclick = () => {
      log("Follow vehicle button clicked.");
      recenterOnVehicleWrapper();
      map.setZoom(17);
    };
    map.controls[window.google.maps.ControlPosition.LEFT_BOTTOM].push(followButton);

    const clickListener = map.addListener("click", (event) => {
      log("Map click listener triggered.");
      const clickLocation = event.latLng;
      const logs = tripLogs.getLogs_(new Date(rangeStart), new Date(rangeEnd)).value();
      let closestEvent = null;
      let closestDistance = 250;

      logs.forEach((logEntry) => {
        const rawLocation = _.get(logEntry, "lastlocation.rawlocation");
        if (rawLocation?.latitude && rawLocation?.longitude) {
          const eventLocation = new window.google.maps.LatLng(rawLocation.latitude, rawLocation.longitude);
          const distance = window.google.maps.geometry.spherical.computeDistanceBetween(clickLocation, eventLocation);
          if (distance < closestDistance) {
            closestEvent = logEntry;
            closestDistance = distance;
          }
        }
      });
      if (closestEvent) {
        setFeaturedObject(closestEvent);
        setTimeout(() => focusSelectedRow(), 0);
      }
    });

    const centerListener = map.addListener(
      "center_changed",
      _.debounce(() => {
        if (mapRef.current) setQueryStringValue("center", JSON.stringify(mapRef.current.getCenter().toJSON()));
      }, 100)
    );
    const headingListener = map.addListener("heading_changed", () => {
      if (mapRef.current) setQueryStringValue("heading", mapRef.current.getHeading());
    });

    return () => {
      log("Map.js: Cleanup from initialization useEffect.");
      dynamicMarkersRef.current.forEach((m) => m.setMap(null));
      dynamicMarkersRef.current = [];
      Object.values(vehicleMarkersRef.current).forEach((marker) => marker && marker.setMap(null));
      vehicleMarkersRef.current = {};
      window.google.maps.event.removeListener(clickListener);
      window.google.maps.event.removeListener(centerListener);
      window.google.maps.event.removeListener(headingListener);
      mapRef.current = null;
    };
  }, []);

  const handlePolylineSubmit = useCallback((waypoints, properties) => {
    const map = mapRef.current;
    if (!map) return;
    log("handlePolylineSubmit called.");

    const path = waypoints.map((wp) => new window.google.maps.LatLng(wp.latitude, wp.longitude));
    const newPolyline = new window.google.maps.Polyline({ path, geodesic: true, ...properties });
    newPolyline.setMap(map);
    setPolylines((prev) => [...prev, newPolyline]);
  }, []);

  const recenterOnVehicleWrapper = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    log("recenterOnVehicleWrapper called for follow mode.");

    let position = null;
    if (selectedRow?.lastlocation?.rawlocation) {
      position = selectedRow.lastlocation.rawlocation;
    } else if (lastValidPositionRef.current) {
      position = lastValidPositionRef.current;
    }

    if (position) map.setCenter({ lat: position.latitude, lng: position.longitude });
    setIsFollowingVehicle((prev) => !prev);
  }, [selectedRow]);

  useEffect(() => {
    const followButton = document.querySelector(".follow-vehicle-button");
    if (followButton) {
      isFollowingVehicle ? followButton.classList.add("active") : followButton.classList.remove("active");
    }
  }, [isFollowingVehicle]);

  // Effect to draw traffic polyline for selected row
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    trafficPolylinesRef.current.forEach((p) => p.setMap(null));
    trafficPolylinesRef.current = [];

    if (!selectedRow) return;

    const routeSegment =
      _.get(selectedRow, "request.vehicle.currentroutesegment") ||
      _.get(selectedRow, "lastlocation.currentroutesegment");
    if (routeSegment) {
      try {
        const decodedPoints = decode(routeSegment);
        if (decodedPoints?.length > 0) {
          const validWaypoints = decodedPoints.map((p) => ({ lat: p.latDegrees(), lng: p.lngDegrees() }));
          const trafficRendering =
            _.get(selectedRow, "request.vehicle.currentroutesegmenttraffic.trafficrendering") ||
            _.get(selectedRow, "lastlocation.currentroutesegmenttraffic.trafficrendering");
          const location = _.get(selectedRow.lastlocation, "location");

          const trafficPolyline = new TrafficPolyline({
            path: validWaypoints,
            map,
            zIndex: 2,
            trafficRendering: structuredClone(trafficRendering),
            currentLatLng: location,
          });

          trafficPolylinesRef.current = trafficPolyline.polylines;
        }
      } catch (error) {
        console.error("Error processing route segment polyline:", error);
      }
    }
  }, [selectedRow]);

  // Effect for updating selected row vehicle marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!selectedRow) {
      Object.values(vehicleMarkersRef.current).forEach((marker) => marker && marker.setMap(null));
      return;
    }

    const location =
      _.get(selectedRow.lastlocation, "location") ||
      _.get(selectedRow.lastlocation, "rawlocation") ||
      _.get(selectedRow.lastlocationResponse, "location");

    if (location?.latitude && location?.longitude) {
      const pos = { lat: location.latitude, lng: location.longitude };
      lastValidPositionRef.current = pos;
      const heading =
        _.get(selectedRow.lastlocation, "heading") || _.get(selectedRow.lastlocationResponse, "heading") || 0;

      if (vehicleMarkersRef.current.background) {
        vehicleMarkersRef.current.background.setPosition(pos);
        if (!vehicleMarkersRef.current.background.getMap()) {
          vehicleMarkersRef.current.background.setMap(map);
        }
      } else {
        vehicleMarkersRef.current.background = new window.google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#FFFFFF",
            fillOpacity: 0.7,
            scale: 18,
            strokeColor: "#FFFFFF",
            strokeWeight: 2,
            strokeOpacity: 0.3,
          },
          zIndex: 9,
        });
      }

      if (vehicleMarkersRef.current.chevron) {
        vehicleMarkersRef.current.chevron.setPosition(pos);
        const icon = vehicleMarkersRef.current.chevron.getIcon();
        icon.rotation = heading;
        vehicleMarkersRef.current.chevron.setIcon(icon);
        if (!vehicleMarkersRef.current.chevron.getMap()) {
          vehicleMarkersRef.current.chevron.setMap(map);
        }
      } else {
        vehicleMarkersRef.current.chevron = new window.google.maps.Marker({
          position: pos,
          map,
          icon: {
            path: "M -1,1 L 0,-1 L 1,1 L 0,0.5 z",
            fillColor: "#4285F4",
            fillOpacity: 1,
            scale: 10,
            strokeColor: "#4285F4",
            strokeWeight: 1,
            rotation: heading,
          },
          zIndex: 10,
        });
      }

      const rawLocation = _.get(selectedRow.lastlocation, "rawlocation");
      if (rawLocation?.latitude && rawLocation?.longitude) {
        const rawPos = { lat: rawLocation.latitude, lng: rawLocation.longitude };
        if (vehicleMarkersRef.current.rawLocation) {
          vehicleMarkersRef.current.rawLocation.setPosition(rawPos);
          if (!vehicleMarkersRef.current.rawLocation.getMap()) {
            vehicleMarkersRef.current.rawLocation.setMap(map);
          }
        } else {
          vehicleMarkersRef.current.rawLocation = new window.google.maps.Marker({
            position: rawPos,
            map,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: "#FF0000",
              fillOpacity: 1,
              scale: 2,
              strokeColor: "#FF0000",
              strokeWeight: 1,
            },
            zIndex: 8,
          });
        }
      } else if (vehicleMarkersRef.current.rawLocation) {
        vehicleMarkersRef.current.rawLocation.setMap(null);
      }

      if (isFollowingVehicle) {
        map.setCenter(pos);
      }
    } else {
      Object.values(vehicleMarkersRef.current).forEach((marker) => marker && marker.setMap(null));
    }
  }, [selectedRow, isFollowingVehicle]);

  const toggleHandlers = useMemo(() => {
    const map = mapRef.current;
    if (!map) {
      return {};
    }
    return getToggleHandlers({
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
      focusSelectedRow,
    });
  }, [mapRef.current, tripLogs, taskLogs, minDate, maxDate, jwt, setFeaturedObject, setTimeRange, focusSelectedRow]);

  useEffect(() => {
    if (_.isEmpty(toggleHandlers)) {
      log("Map.js: Toggles effect skipped because handlers are not ready.");
      return;
    }
    for (const toggle of toggles) {
      if (toggleHandlers[toggle.id]) {
        toggleHandlers[toggle.id](toggleOptions[toggle.id]);
      }
    }
  }, [toggleOptions, toggles, toggleHandlers, minDate, maxDate]);

  useEffect(() => {
    const centerOnLocationImpl = (lat, lng) => {
      const map = mapRef.current;
      if (map) {
        log(`Centering map on ${lat}, ${lng} with zoom 13.`);
        map.setCenter({ lat, lng });
        map.setZoom(13);
      }
    };
    if (setCenterOnLocation) {
      setCenterOnLocation(() => centerOnLocationImpl);
    }
  }, [setCenterOnLocation]);

  return (
    <>
      <div ref={mapDivRef} id="map" style={{ height: "100%", width: "100%" }} />
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

function MapContent(props) {
  const journeySharingLib = useMapsLibrary("journeySharing");
  const geometryLib = useMapsLibrary("geometry");
  if (!journeySharingLib || !geometryLib) return <h3>Loading Maps...</h3>;
  return <MapComponent {...props} />;
}

export default function Map(props) {
  const { apikey } = props.logData;
  const stableSetCenterOnLocation = useCallback(props.setCenterOnLocation, []);
  const stableSetRenderMarkerOnMap = useCallback(props.setRenderMarkerOnMap, []);
  return (
    <APIProvider apiKey={apikey} solutionChannel="GMP_visgl_reactgooglemaps_v1_GMP_FLEET_DEBUGGER">
      <MapContent
        {...props}
        setCenterOnLocation={stableSetCenterOnLocation}
        setRenderMarkerOnMap={stableSetRenderMarkerOnMap}
      />
    </APIProvider>
  );
}
