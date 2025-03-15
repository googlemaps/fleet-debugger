// src/TrafficPolyline.test.js

import { TRAFFIC_COLORS } from "./TrafficPolyline";

// Mock turf due to module compatibility
/* eslint-disable no-unused-vars */
jest.mock("@turf/turf", () => ({
  lineString: (coords) => ({ type: "LineString", coordinates: coords }),
  length: () => 10,
  along: (_line, _distance) => ({
    type: "Point",
    coordinates: [0, 0],
  }),
  lineSlice: () => ({
    type: "LineString",
    geometry: {
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    },
  }),
}));

// Mock google maps
global.google = {
  maps: {
    Polyline: class MockPolyline {
      constructor(options) {
        this.options = options;
      }
      setMap(map) {
        this.map = map;
      }
    },
  },
};

describe("TrafficPolyline", () => {
  let TrafficPolyline;

  beforeEach(() => {
    jest.resetModules();
    TrafficPolyline = require("./TrafficPolyline").default;
  });

  const samplePath = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 1 },
  ];

  test("creates STYLE_NORMAL polyline when no traffic data provided", () => {
    const polyline = new TrafficPolyline({
      path: samplePath,
      map: {},
    });

    expect(polyline.polylines.length).toBe(1);
    expect(polyline.polylines[0].options.strokeColor).toBe(TRAFFIC_COLORS.STYLE_NORMAL);
  });

  test("creates NORMAL polylines when traffic data exists but no stretches", () => {
    const polyline = new TrafficPolyline({
      path: samplePath,
      trafficRendering: { roadstretch: [] },
      map: {},
    });

    expect(polyline.polylines.length).toBe(1);
    expect(polyline.polylines[0].options.strokeColor).toBe(TRAFFIC_COLORS.STYLE_NORMAL);
  });

  test("creates multiple polylines for different traffic segments", () => {
    const trafficRendering = {
      roadstretch: [
        {
          style: "STYLE_SLOWER_TRAFFIC",
          lengthmeters: 100,
          offsetmeters: 0,
        },
        {
          style: "STYLE_TRAFFIC_JAM",
          lengthmeters: 100,
          offsetmeters: 200,
        },
      ],
    };

    const polyline = new TrafficPolyline({
      path: samplePath,
      trafficRendering,
      map: {},
    });

    expect(polyline.polylines.length).toBeGreaterThan(1);

    const colors = polyline.polylines.map((p) => p.options.strokeColor);
    expect(colors).toContain(TRAFFIC_COLORS.STYLE_SLOWER_TRAFFIC);
    expect(colors).toContain(TRAFFIC_COLORS.STYLE_TRAFFIC_JAM);
  });

  test("handles invalid path gracefully", () => {
    const polyline = new TrafficPolyline({
      path: [],
      map: {},
    });

    expect(polyline.polylines.length).toBe(1);
    expect(polyline.polylines[0].options.strokeColor).toBe(TRAFFIC_COLORS.STYLE_NO_DATA);
  });

  test("setMap updates all polylines", () => {
    const polyline = new TrafficPolyline({
      path: samplePath,
      map: {},
    });

    const newMap = {};
    polyline.setMap(newMap);

    polyline.polylines.forEach((p) => {
      expect(p.map).toBe(newMap);
    });
  });
});
