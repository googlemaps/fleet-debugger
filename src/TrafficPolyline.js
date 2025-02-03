// TrafficPolyline.js
import * as turf from "@turf/turf";
import { log } from "./Utils";

export const TRAFFIC_COLORS = {
  STYLE_NO_DATA: "#808080", // Gray
  STYLE_NORMAL: "#4285F4", // Google Maps Blue
  STYLE_SLOWER_TRAFFIC: "#FFA500", // Orange
  STYLE_TRAFFIC_JAM: "#FF0000", // Red
};

export class TrafficPolyline {
  constructor({ path, trafficRendering, map }) {
    this.polylines = [];
    this.path = path;
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
      // If no traffic rendering or no road stretches, return a single NO_DATA segment
      if (!trafficRendering?.roadstretch?.length) {
        return [
          {
            path: this.path,
            style: "STYLE_NO_DATA",
          },
        ];
      }

      const line = turf.lineString(
        this.path.map((point) => [point.lng, point.lat])
      );
      const totalLength = turf.length(line, { units: "meters" });
      const splitPoints = this.calculateSplitPoints(
        trafficRendering.roadstretch,
        totalLength
      );

      return this.createSegmentsData(
        line,
        splitPoints,
        trafficRendering.roadstretch
      );
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
      if (
        startDistance >= stretch.offsetmeters &&
        startDistance < stretch.offsetmeters + stretch.lengthmeters
      ) {
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
    this.segments.forEach((segment) => {
      const polyline = new google.maps.Polyline({
        path: segment.path,
        geodesic: true,
        strokeColor: TRAFFIC_COLORS[segment.style],
        strokeOpacity: 1,
        strokeWeight: 4,
        map: this.map,
        isRouteSegment: true,
      });
      this.polylines.push(polyline);
    });
  }

  setMap(map) {
    this.polylines.forEach((polyline) => polyline.setMap(map));
  }
}

export default TrafficPolyline;
