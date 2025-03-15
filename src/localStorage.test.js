// src/localStorage.test.js

import fs from "fs";
import { parseJsonContent, removeEmptyObjects, ensureCorrectFormat } from "./localStorage";

// Helper function to load test data
function loadTestData(filename) {
  return JSON.parse(fs.readFileSync(`./datasets/${filename}`));
}

test("parseJsonContent handles valid JSON", () => {
  const validJson = JSON.stringify({ test: "data" });
  const result = parseJsonContent(validJson);
  expect(result).toStrictEqual({ test: "data" });
});

test("parseJsonContent handles multiple JSON objects", () => {
  const multipleJson = '{"test": "data1"},{"test": "data2"}';
  const result = parseJsonContent(multipleJson);
  expect(result).toHaveLength(2);
  expect(result[0]).toStrictEqual({ test: "data1" });
  expect(result[1]).toStrictEqual({ test: "data2" });
});

test("parseJsonContent handles JSON array", () => {
  const arrayJson = '[{"key": "value1"},{"test": "data2"}]';
  const result = parseJsonContent(arrayJson);
  expect(result).toHaveLength(2);
  expect(result[0]).toStrictEqual({ key: "value1" });
  expect(result[1]).toStrictEqual({ test: "data2" });
});

test("parseJsonContent throws error for invalid JSON", () => {
  const invalidJson = "{invalid}";
  expect(() => parseJsonContent(invalidJson)).toThrow("Invalid JSON content");
});

test("removeEmptyObjects removes empty nested objects", () => {
  const input = {
    a: {},
    b: { c: {}, d: { e: 1 } },
  };
  const expected = {
    b: { d: { e: 1 } },
  };
  expect(removeEmptyObjects(input)).toStrictEqual(expected);
});

test("ensureCorrectFormat handles LMFS logs", () => {
  const lmfsData = loadTestData("lmfs.json");
  const result = ensureCorrectFormat(lmfsData.rawLogs);
  expect(result.solutionType).toBe("LMFS");
});

test("ensureCorrectFormat handles ODRD logs", () => {
  const odrdData = loadTestData("jump-demo.json");
  const result = ensureCorrectFormat(odrdData.rawLogs);
  expect(result.solutionType).toBe("ODRD");
});

test("ensureCorrectFormat merges restricted attributes", () => {
  const parentLog = {
    insertId: "parent",
    jsonPayload: {
      "@type": "type.googleapis.com/Normal",
      request: {},
      response: {},
    },
  };

  const restrictedLog = {
    jsonPayload: {
      "@type": "type.googleapis.com/Restricted",
      parentInsertId: "parent",
      request: {
        waypoints: ["point1", "point2"],
      },
    },
  };

  const result = ensureCorrectFormat([parentLog, restrictedLog]);
  expect(result.rawLogs[0].jsonPayload.request.waypoints).toStrictEqual(["point1", "point2"]);
  expect(result.rawLogs.length).toBe(1);
});

test("ensureCorrectFormat merges non top level vehicle restricted attributes", () => {
  const parentLog = {
    insertId: "parent",
    jsonPayload: {
      "@type": "type.googleapis.com/maps.fleetengine.v1.UpdateVehicleLog",
      request: {
        vehicle: {
          name: "test-vehicle",
        },
      },
      response: {},
    },
  };

  const restrictedLog = {
    jsonPayload: {
      "@type": "type.googleapis.com/maps.fleetengine.v1.UpdateVehicleRestrictedLog",
      parentInsertId: "parent",
      request: {
        vehicle: {
          currentRouteSegment: "testSegment123",
        },
      },
      response: {
        currentRouteSegment: "responseSegment456",
        waypoints: [
          {
            encodedPathToWaypoint: "encodedPath789",
          },
        ],
      },
    },
  };

  const result = ensureCorrectFormat([parentLog, restrictedLog]);

  // Verify only one log remains (restricted log is filtered out)
  expect(result.rawLogs.length).toBe(1);

  // Verify vehicle attributes are merged correctly
  expect(result.rawLogs[0].jsonPayload.request.vehicle.currentRouteSegment).toBe("testSegment123");

  // Verify direct response attributes are merged
  expect(result.rawLogs[0].jsonPayload.response.currentRouteSegment).toBe("responseSegment456");
  expect(result.rawLogs[0].jsonPayload.response.waypoints[0].encodedPathToWaypoint).toBe("encodedPath789");

  // Verify original vehicle attributes are preserved
  expect(result.rawLogs[0].jsonPayload.request.vehicle.name).toBe("test-vehicle");
});
