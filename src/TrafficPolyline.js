// src/TrafficPolyline.js

import * as turf from "@turf/turf";
import { log } from "./Utils";

export const TRAFFIC_COLORS = {
  STYLE_NO_DATA: "#808080", // Gray
  NO_DATA: "#808080",
  STYLE_NORMAL: "#4285F4", // Google Maps Blue
  NORMAL: "#4285F4",
  STYLE_SLOWER_TRAFFIC: "#FFA500", // Orange
  SLOWER_TRAFFIC: "#FFA500",
  STYLE_TRAFFIC_JAM: "#FF0000", // Red
  TRAFFIC_JAM: "#FF0000",
};

export class TrafficPolyline {
  constructor({ path, zIndex, isTripEvent, trafficRendering, currentLatLng, map }) {
    this.polylines = [];
    this.path = path;
    this.zIndex = zIndex;
    this.isTripEvent = isTripEvent;
    this.currentLatLng = currentLatLng;
    this.map = map;
    this.segments = this.calculateSegments(trafficRendering);
    this.createPolylines();
  }

  calculateSegments(trafficRendering) {
    if (!this.path || this.path.length < 2) {
      log("Invalid path provided to TrafficPolyline");
      return [
        {
          path: this.path,
          style: "STYLE_NO_DATA",
        },
      ];
    }

    try {
      if (!trafficRendering) {
        trafficRendering = { roadstretch: [] };
      }

      // Add traveled route as NO_DATA if we have currentLatLng
      if (this.currentLatLng && this.currentLatLng.longitude && this.currentLatLng.latitude) {
        const line = turf.lineString(this.path.map((point) => [point.lng, point.lat]));
        const currentPoint = turf.point([this.currentLatLng.longitude, this.currentLatLng.latitude]);
        const startPoint = turf.point(line.geometry.coordinates[0]);

        try {
          const traveledLine = turf.lineSlice(startPoint, currentPoint, line);
          const distanceInMeters = turf.length(traveledLine, { units: "kilometers" }) * 1000;

          // Add the traveled segment at the start of roadstretch array
          if (distanceInMeters > 0) {
            trafficRendering.roadstretch = [
              {
                style: "STYLE_NO_DATA",
                offsetmeters: 0,
                lengthmeters: distanceInMeters,
              },
              ...(trafficRendering.roadstretch || []),
            ];
          }
        } catch (error) {
          log("Error calculating traveled route segment:", error);
        }
      }

      if (!trafficRendering.roadstretch?.length) {
        return [
          {
            path: this.path,
            style: "STYLE_NORMAL",
          },
        ];
      }

      const line = turf.lineString(this.path.map((point) => [point.lng, point.lat]));
      const totalLength = turf.length(line, { units: "meters" });
      const splitPoints = this.calculateSplitPoints(trafficRendering.roadstretch, totalLength);

      return this.createSegmentsData(line, splitPoints, trafficRendering.roadstretch);
    } catch (error) {
      log("Error calculating segments:", error);
      return [
        {
          path: this.path,
          style: "STYLE_NO_DATA",
        },
      ];
    }
  }

  calculateSplitPoints(roadStretches, totalLength) {
    let points = [0];
    roadStretches.forEach((stretch) => {
      points.push(stretch.offsetmeters);
      points.push(stretch.offsetmeters + stretch.lengthmeters);
    });
    points.push(totalLength * 1000);
    return [...new Set(points)].sort((a, b) => a - b);
  }

  createSegmentsData(line, splitPoints, roadStretches) {
    const segments = [];
    for (let i = 0; i < splitPoints.length - 1; i++) {
      const startDistance = splitPoints[i];
      const endDistance = splitPoints[i + 1];
      const style = this.getSegmentStyle(startDistance, roadStretches);
      const segmentPath = this.getSegmentPath(line, startDistance, endDistance);

      segments.push({
        path: segmentPath,
        style: style,
      });
    }
    return segments;
  }

  getSegmentStyle(startDistance, roadStretches) {
    for (const stretch of roadStretches) {
      if (startDistance >= stretch.offsetmeters && startDistance < stretch.offsetmeters + stretch.lengthmeters) {
        return stretch.style;
      }
    }
    return "STYLE_NORMAL";
  }

  getSegmentPath(line, startDistance, endDistance) {
    const startPoint = turf.along(line, startDistance / 1000, {
      units: "kilometers",
    });
    const endPoint = turf.along(line, endDistance / 1000, {
      units: "kilometers",
    });
    const sliced = turf.lineSlice(startPoint, endPoint, line);
    return sliced.geometry.coordinates.map((coord) => ({
      lat: coord[1],
      lng: coord[0],
    }));
  }

  createPolylines() {
    if (this.isTripEvent) {
      const polyline = new google.maps.Polyline({
        path: this.path,
        geodesic: true,
        strokeColor: "#000000",
        strokeOpacity: 1,
        strokeWeight: 1.5,
        zIndex: this.zIndex || 3,
        isRouteSegment: true,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.FORWARD_OPEN_ARROW,
              scale: 1.5,
              strokeWeight: 1,
            },
            offset: "50%",
            repeat: "100px",
          },
        ],
        map: this.map,
        clickable: false,
      });
      this.polylines.push(polyline);
      return;
    }

    this.segments.forEach((segment) => {
      const polyline = new google.maps.Polyline({
        path: segment.path,
        zIndex: this.zIndex || 0,
        geodesic: true,
        strokeColor: TRAFFIC_COLORS[segment.style],
        strokeOpacity: 1,
        strokeWeight: 4,
        map: this.map,
        isRouteSegment: true,
        clickable: false,
      });
      this.polylines.push(polyline);
    });
  }

  setMap(map) {
    this.polylines.forEach((polyline) => polyline.setMap(map));
  }
}

export default TrafficPolyline;
