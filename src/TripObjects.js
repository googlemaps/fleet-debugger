// src/TripObjects.js

import { log } from "./Utils";
import { getColor } from "./Trip";

export class TripObjects {
  constructor({ map, setFeaturedObject, setTimeRange }) {
    this.map = map;
    this.markers = new Map();
    this.paths = new Map();
    this.arrows = new Map();
    this.setFeaturedObject = setFeaturedObject;
    this.setTimeRange = setTimeRange;
  }

  createSVGMarker(type, color) {
    const isPickup = type.toLowerCase().includes("pickup");
    const isActual = type.includes("actual");

    const createChevronPath = (direction, shift = 0) => {
      let points;
      if (direction === "up") {
        points = [
          { x: 12, y: 20 + shift }, // Top point of chevron
          { x: 8, y: 24 + shift }, // Bottom left
          { x: 16, y: 24 + shift }, // Bottom right
          { x: 12, y: 20 + shift },
        ];
      } else {
        // "down"
        points = [
          { x: 12, y: 24 + shift }, // Bottom point of chevron
          { x: 8, y: 20 + shift }, // Top left
          { x: 16, y: 20 + shift }, // Top right
          { x: 12, y: 24 + shift },
        ];
      }

      return `<path d="M${points[0].x} ${points[0].y}L${points[1].x} ${points[1].y}L${points[2].x} ${points[2].y}L${points[3].x} ${points[3].y}Z" fill="${color}" stroke="${color}" stroke-width="1"/>`;
    };

    const svgBase = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      ${isActual ? (isPickup ? createChevronPath("up", -4) : createChevronPath("down", -4)) : ""}
      ${isPickup ? createChevronPath("up") : createChevronPath("down")}
    </svg>`;

    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgBase),
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 24),
    };
  }

  createMarkerWithEvents(point, type, color, pairedPoint, tripId) {
    if (!point) return null;

    const marker = new google.maps.Marker({
      position: { lat: point.latitude, lng: point.longitude },
      icon: this.createSVGMarker(type, color),
      map: this.map,
    });

    if (pairedPoint) {
      // Store the arrow in the class instance using a unique key
      const arrowKey = `${tripId}_${type.includes("actual") ? type.replace("actual", "") : type}`;

      google.maps.event.addListener(marker, "click", () => {
        log(`${type} marker clicked`);

        if (this.arrows.has(arrowKey)) {
          this.arrows.get(arrowKey).setMap(null);
          this.arrows.delete(arrowKey);
        } else {
          // Create arrow from requested to actual
          const from = type.includes("actual") ? pairedPoint : point;
          const to = type.includes("actual") ? point : pairedPoint;
          const arrow = this.createConnectingArrow(from, to, color);
          if (arrow) {
            this.arrows.set(arrowKey, arrow);
          }
        }
      });
    }

    return marker;
  }

  createConnectingArrow(from, to, color) {
    if (!from || !to) return null;

    return new google.maps.Polyline({
      path: [
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
      ],
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: 1,
      icons: [
        {
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 1,
          },
          offset: "100%",
        },
      ],
      clickable: false,
      map: this.map,
    });
  }

  addTripVisuals(trip, minDate, maxDate) {
    const tripId = trip.tripName;
    const isNonTripSegment = tripId.startsWith("non-trip-segment-");

    log(`Processing trip visuals for ${tripId}`, {
      isNonTripSegment,
      coordsCount: trip.pathCoords.length,
      firstUpdate: trip.firstUpdate,
      lastUpdate: trip.lastUpdate,
      pickupPoint: trip.getPickupPoint(),
      actualPickupPoint: trip.getActualPickupPoint(),
      dropoffPoint: trip.getDropoffPoint(),
      actualDropoffPoint: trip.getActualDropoffPoint(),
    });

    this.clearTripObjects(tripId);

    // Add path polyline
    const tripCoords = trip.getPathCoords(minDate, maxDate);
    if (tripCoords.length > 0) {
      const strokeColor = isNonTripSegment ? "#474647" : getColor(trip.tripIdx);

      const path = new google.maps.Polyline({
        path: tripCoords,
        geodesic: true,
        strokeColor: strokeColor,
        strokeOpacity: 0.6,
        strokeWeight: 5,
        clickable: true,
        zIndex: 1,
        map: this.map,
      });

      google.maps.event.addListener(path, "mouseover", () => {
        path.setOptions({ strokeOpacity: 0.8, strokeWeight: 6, zIndex: 100 });
      });

      google.maps.event.addListener(path, "mouseout", () => {
        path.setOptions({ strokeOpacity: 0.6, strokeWeight: 5, zIndex: 1 });
      });

      // Handle click on polyline but pass the event through to the map
      google.maps.event.addListener(path, "click", (event) => {
        // Trigger a map click at the same position to maintain selection functionality
        google.maps.event.trigger(this.map, "click", event);
        return false; // Prevent default action to avoid double handling
      });

      this.paths.set(tripId, path);
    }

    // Skip creating markers for non-trip segments
    if (isNonTripSegment) {
      return;
    }

    const markers = [];

    // Get points
    const pickupPoint = trip.getPickupPoint();
    const actualPickupPoint = trip.getActualPickupPoint();
    const dropoffPoint = trip.getDropoffPoint();
    const actualDropoffPoint = trip.getActualDropoffPoint();

    // Create pickup markers
    const pickupMarker = this.createMarkerWithEvents(pickupPoint, "pickup", "#3d633d", actualPickupPoint, tripId);
    if (pickupMarker) markers.push(pickupMarker);

    const actualPickupMarker = this.createMarkerWithEvents(
      actualPickupPoint,
      "actualPickup",
      "#3d633d",
      pickupPoint,
      tripId
    );
    if (actualPickupMarker) markers.push(actualPickupMarker);

    // Create dropoff markers
    const dropoffMarker = this.createMarkerWithEvents(dropoffPoint, "dropoff", "#0000FF", actualDropoffPoint, tripId);
    if (dropoffMarker) markers.push(dropoffMarker);

    const actualDropoffMarker = this.createMarkerWithEvents(
      actualDropoffPoint,
      "actualDropoff",
      "#0000FF",
      dropoffPoint,
      tripId
    );
    if (actualDropoffMarker) markers.push(actualDropoffMarker);

    this.markers.set(tripId, markers);
  }

  clearTripObjects(tripId) {
    if (this.paths.has(tripId)) {
      this.paths.get(tripId).setMap(null);
      this.paths.delete(tripId);
    }

    if (this.markers.has(tripId)) {
      this.markers.get(tripId).forEach((marker) => marker.setMap(null));
      this.markers.delete(tripId);
    }

    if (this.arrows.has(tripId)) {
      this.arrows.get(tripId).forEach((arrow) => arrow.setMap(null));
      this.arrows.delete(tripId);
    }
  }

  clearAll() {
    for (const tripId of this.paths.keys()) {
      this.clearTripObjects(tripId);
    }
  }
}
