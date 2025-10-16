// src/TrafficPolyline.test.js
import { TRAFFIC_COLORS } from "./TrafficPolyline";
import TrafficPolyline from "./TrafficPolyline";

// Mock the entire turf library. The implementation details don't matter,
// only that the functions return an object with the expected shape to prevent crashes.
jest.mock("@turf/turf", () => ({
  lineString: () => ({ geometry: { coordinates: [] } }),
  length: () => 1000,
  point: () => ({ geometry: { coordinates: [] } }),
  lineSlice: () => ({ geometry: { coordinates: [[], []] } }),
  along: () => ({ geometry: { coordinates: [] } }),
}));

// Mock the Google Maps API
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
    SymbolPath: {
      FORWARD_OPEN_ARROW: "test-arrow",
    },
  },
};

describe("TrafficPolyline", () => {
  const samplePath = [
    { lat: 0, lng: 0 },
    { lat: 1, lng: 1 },
  ];

  test("creates casing and fill polylines when no traffic data is provided", () => {
    const polyline = new TrafficPolyline({ path: samplePath, map: {} });
    expect(polyline.polylines.length).toBe(2); // Casing + Fill
    expect(polyline.polylines[1].options.strokeColor).toBe(TRAFFIC_COLORS.STYLE_NORMAL);
  });

  test("creates a single polyline for trip events", () => {
    const polyline = new TrafficPolyline({ path: samplePath, map: {}, isTripEvent: true });
    expect(polyline.polylines.length).toBe(1);
    expect(polyline.polylines[0].options.strokeColor).toBe("#000000");
  });

  test("creates multiple polyline pairs for different traffic segments", () => {
    const trafficRendering = {
      roadstretch: [
        { style: "SLOWER_TRAFFIC", lengthmeters: 100, offsetmeters: 0 },
        { style: "TRAFFIC_JAM", lengthmeters: 100, offsetmeters: 200 },
      ],
    };
    const polyline = new TrafficPolyline({ path: samplePath, trafficRendering, map: {} });
    expect(polyline.polylines.length).toBeGreaterThan(2);
    const colors = polyline.polylines.map((p) => p.options.strokeColor);
    expect(colors).toContain(TRAFFIC_COLORS.SLOWER_TRAFFIC);
    expect(colors).toContain(TRAFFIC_COLORS.TRAFFIC_JAM);
  });

  test("handles traffic data with missing offsetmeters without crashing", () => {
    const trafficRendering = {
      roadstretch: [
        { style: "TRAFFIC_JAM", lengthmeters: 200 }, // No offsetmeters
      ],
    };
    let polyline;
    // The test passes if it doesn't throw an error.
    expect(() => {
      polyline = new TrafficPolyline({ path: samplePath, trafficRendering, map: {} });
    }).not.toThrow();
    const colors = polyline.polylines.map((p) => p.options.strokeColor);
    expect(colors).toContain(TRAFFIC_COLORS.TRAFFIC_JAM);
  });

  test("correctly processes unsorted roadstretch data", () => {
    const trafficRendering = {
      roadstretch: [
        { style: "SLOWER_TRAFFIC", offsetmeters: 500, lengthmeters: 100 },
        { style: "TRAFFIC_JAM", offsetmeters: 100, lengthmeters: 200 },
      ],
    };
    const polyline = new TrafficPolyline({ path: samplePath, trafficRendering, map: {} });
    // Check that segments were created, implying the sorting worked.
    expect(polyline.segments.length).toBeGreaterThan(2);
  });

  test('creates a "NO_DATA" segment for the traveled portion of the path', () => {
    const polyline = new TrafficPolyline({
      path: samplePath,
      currentLatLng: { latitude: 0.5, longitude: 0.5 },
      map: {},
    });
    const colors = polyline.polylines.map((p) => p.options.strokeColor);
    expect(colors).toContain(TRAFFIC_COLORS.STYLE_NO_DATA);
  });

  test("handles invalid or empty path gracefully", () => {
    const polyline = new TrafficPolyline({ path: [], map: {} });
    expect(polyline.polylines.length).toBe(2);
    expect(polyline.polylines[1].options.strokeColor).toBe(TRAFFIC_COLORS.STYLE_NO_DATA);
  });

  test("setMap updates all child polylines", () => {
    const polyline = new TrafficPolyline({ path: samplePath, map: {} });
    const newMap = { id: "new-map" };
    polyline.setMap(newMap);
    polyline.polylines.forEach((p) => {
      expect(p.map).toBe(newMap);
    });
  });
});
