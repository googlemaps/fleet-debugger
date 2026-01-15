import { decode as decodeS2 } from "s2polyline-ts";

/**
 * Decodes a Google Maps encoded polyline string into an array of LatLng objects.
 * Based on the Google Polyline Algorithm.
 * @param {string} encoded
 * @returns {Array<{latitude: number, longitude: number}>}
 */
export function decodeGooglePolyline(encoded) {
  const points = [];
  let index = 0,
    len = encoded.length;
  let lat = 0,
    lng = 0;

  while (index < len) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

/**
 * Parses polyline input in various formats: S2, Google Encoded, JSON, or Plain Text.
 * @param {string} input
 * @returns {Array<{latitude: number, longitude: number}>}
 */
export function parsePolylineInput(input) {
  const trimmedInput = input.trim();

  // Check if it's obviously JSON or plain text coordinate list
  const isJsonLike = (trimmedInput.startsWith("[") || trimmedInput.startsWith("{")) && trimmedInput.includes(":");

  if (!isJsonLike) {
    try {
      // S2 strings usually don't have spaces or certain JSON characters
      if (!trimmedInput.includes(" ") && !trimmedInput.includes('"')) {
        const decodedPoints = decodeS2(trimmedInput);
        if (decodedPoints && decodedPoints.length > 0) {
          return decodedPoints.map((point) => ({
            latitude: point.latDegrees(),
            longitude: point.lngDegrees(),
          }));
        }
      }
    } catch (e) {
      // Continue to next format
    }

    try {
      // Sanity check: Google polylines shouldn't have spaces or newlines
      if (!trimmedInput.includes("\n") && !trimmedInput.includes(" ")) {
        const decodedPoints = decodeGooglePolyline(trimmedInput);
        if (decodedPoints && decodedPoints.length > 0) {
          return decodedPoints;
        }
      }
    } catch (e) {
      // Continue to next format
    }
  }

  try {
    const jsonString = trimmedInput.replace(/(\w+):/g, '"$1":').replace(/\s+/g, " ");
    const inputWithBrackets = jsonString.startsWith("[") && jsonString.endsWith("]") ? jsonString : `[${jsonString}]`;
    const waypoints = JSON.parse(inputWithBrackets);

    const validWaypoints = waypoints.filter(
      (waypoint) =>
        typeof waypoint === "object" &&
        "latitude" in waypoint &&
        "longitude" in waypoint &&
        typeof waypoint.latitude === "number" &&
        typeof waypoint.longitude === "number"
    );

    if (validWaypoints.length > 0) {
      return validWaypoints;
    }
  } catch (e) {
    // Fall through to error
  }

  throw new Error("Invalid polyline format or no valid coordinates found.");
}
