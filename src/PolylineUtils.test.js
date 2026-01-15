import { parsePolylineInput } from "./PolylineUtils";

describe("PolylineUtils", () => {
  const EXPECTED_POINTS = [
    { latitude: 37.42213, longitude: -122.0848 },
    { latitude: 37.4152, longitude: -122.0627 },
    { latitude: 37.427, longitude: -122.0854 },
  ];

  test("decodes a GMP Encoded Polyline", () => {
    const encoded = "i_lcF~tchVhj@ciCwhAzlC";
    const decoded = parsePolylineInput(encoded);

    expect(decoded).toHaveLength(EXPECTED_POINTS.length);
    for (let i = 0; i < EXPECTED_POINTS.length; i++) {
      expect(decoded[i].latitude).toBeCloseTo(EXPECTED_POINTS[i].latitude, 5);
      expect(decoded[i].longitude).toBeCloseTo(EXPECTED_POINTS[i].longitude, 5);
    }
  });

  test("decodes an S2 Polyline", () => {
    const s2String =
      "AQMAAAA7_tIhjf_avysne_M5iOW__WHh1yJy4z9MIcUK8Pvav7QbiLMRiuW_SWY5Y1lx4z-CIIuaN__av1Eb3-fUh-W_iPpHZ7By4z8=";
    const decoded = parsePolylineInput(s2String);

    expect(decoded).toHaveLength(EXPECTED_POINTS.length);
    for (let i = 0; i < EXPECTED_POINTS.length; i++) {
      expect(decoded[i].latitude).toBeCloseTo(EXPECTED_POINTS[i].latitude, 5);
      expect(decoded[i].longitude).toBeCloseTo(EXPECTED_POINTS[i].longitude, 5);
    }
  });

  test("decodes a GMP Unencoded Polyline (Plain Text)", () => {
    const input =
      "{ latitude: 37.42213, longitude: -122.0848 }, { latitude: 37.4152, longitude: -122.0627 }, { latitude: 37.427, longitude: -122.0854 }";
    const decoded = parsePolylineInput(input);

    expect(decoded).toHaveLength(EXPECTED_POINTS.length);
    for (let i = 0; i < EXPECTED_POINTS.length; i++) {
      expect(decoded[i].latitude).toBe(EXPECTED_POINTS[i].latitude);
      expect(decoded[i].longitude).toBe(EXPECTED_POINTS[i].longitude);
    }
  });

  test("decodes a JSON Polyline", () => {
    const input = JSON.stringify(EXPECTED_POINTS);
    const decoded = parsePolylineInput(input);

    expect(decoded).toHaveLength(EXPECTED_POINTS.length);
    for (let i = 0; i < EXPECTED_POINTS.length; i++) {
      expect(decoded[i].latitude).toBe(EXPECTED_POINTS[i].latitude);
      expect(decoded[i].longitude).toBe(EXPECTED_POINTS[i].longitude);
    }
  });

  test("throws error on invalid input", () => {
    expect(() => parsePolylineInput("not a polyline")).toThrow();
  });
});
