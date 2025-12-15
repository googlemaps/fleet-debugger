// src/localStorage.test.js
import fs from "fs";
import { parseJsonContent, removeEmptyObjects, ensureCorrectFormat, sortObjectKeysRecursively } from "./localStorage";

// Helper function to load test data
function loadTestData(filename) {
  return JSON.parse(fs.readFileSync(`./datasets/${filename}`));
}

// --- Embedded Test Data ---
const MOCK_CLOUD_LOGGING_EXPORT = [
  {
    insertId: "parent1",
    jsonPayload: {
      "@type": "UpdateTripLog",
      request: { original_data: "value" },
      response: { name: "trip_A" },
    },
  },
  {
    insertId: "parent1.tos",
    jsonPayload: {
      "@type": "UpdateTripRestrictedLog",
      parentInsertId: "parent1",
      request: { waypoints: ["wp1", "wp2"] },
    },
  },
];

const MOCK_RAW_PAYLOAD_ARRAY = [
  {
    "@type": "UpdateVehicleLog",
    request: { header: { sdk_version: "1.0" }, vehicle_id: "vehicle_extra" },
    timestamp: "2025-01-01T00:00:00Z",
  },
];

const MOCK_APP_EXPORT = {
  rawLogs: [
    {
      insertid: "app_export_1", // Already normalized
      jsonpayload: {
        "@type": "UpdateVehicleLog",
        request: { vehicleid: "vehicle_app_export" },
      },
    },
  ],
  solutionType: "ODRD",
};

test("sortObjectKeysRecursively sorts object keys recursively but preserves array order", () => {
  const unsorted = {
    c: 3,
    a: 1,
    b: [{ z: "last", x: "first" }, { y: "middle" }],
  };

  const expected = {
    a: 1,
    b: [{ x: "first", z: "last" }, { y: "middle" }],
    c: 3,
  };

  const sorted = sortObjectKeysRecursively(unsorted);

  // Using JSON.stringify provides a simple and effective way to verify
  // both the structure and the key order of the entire object.
  expect(JSON.stringify(sorted)).toBe(JSON.stringify(expected));
});

describe("parseJsonContent", () => {
  it("should handle a valid JSON string", () => {
    const validJson = JSON.stringify({ test: "data" });
    expect(parseJsonContent(validJson)).toEqual({ test: "data" });
  });

  it("should handle a pre-parsed JavaScript object", () => {
    const validObject = { test: "data" };
    expect(parseJsonContent(validObject)).toEqual({ test: "data" });
  });

  it("should handle multiple JSON objects in a string", () => {
    const multipleJson = '{"test": "data1"},{"test": "data2"}';
    const result = parseJsonContent(multipleJson);
    expect(result).toEqual([{ test: "data1" }, { test: "data2" }]);
  });

  it("should throw an error for invalid JSON", () => {
    // Temporarily spy on console.error and replace it with a function that does nothing.
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    const invalidJson = "{invalid}";
    expect(() => parseJsonContent(invalidJson)).toThrow("Invalid JSON content");
    consoleErrorSpy.mockRestore();
  });

  it("should remove underscores and lowercase keys recursively", () => {
    const nestedJson = { top_level: { nested_key: "value" } };
    const result = parseJsonContent(nestedJson);
    expect(result).toEqual({ toplevel: { nestedkey: "value" } });
  });

  it("should flatten value objects recursively", () => {
    const valueObjectJson = { level1: { valueObj: { value: "flattened" } } };
    const result = parseJsonContent(valueObjectJson);
    expect(result).toEqual({ level1: { valueobj: "flattened" } });
  });
});

describe("ensureCorrectFormat", () => {
  it("should correctly merge TOS-restricted logs and then normalize them", () => {
    const result = ensureCorrectFormat(MOCK_CLOUD_LOGGING_EXPORT);
    expect(result.rawLogs).toHaveLength(1);
    const mergedPayload = result.rawLogs[0].jsonpayload;
    expect(mergedPayload.request.waypoints).toEqual(["wp1", "wp2"]);
    expect(mergedPayload.request.originaldata).toBe("value");
    expect(result.rawLogs[0].insertid).toBe("parent1");
  });

  it("should handle raw payload arrays from other data sources", () => {
    const result = ensureCorrectFormat(MOCK_RAW_PAYLOAD_ARRAY);
    expect(result.rawLogs).toHaveLength(1);
    const normalizedPayload = result.rawLogs[0].jsonpayload;
    expect(normalizedPayload.request.vehicleid).toBe("vehicle_extra");
    expect(normalizedPayload.request).not.toHaveProperty("vehicle_id");
  });

  it("should handle the app's own pre-processed export format", () => {
    const result = ensureCorrectFormat(MOCK_APP_EXPORT);
    expect(result.rawLogs).toHaveLength(1);
    expect(result.rawLogs[0].jsonpayload.request.vehicleid).toBe("vehicle_app_export");
    expect(result.solutionType).toBe("ODRD");
  });

  it("should correctly identify LMFS logs from a full data file", () => {
    const lmfsData = loadTestData("lmfs.json");
    const result = ensureCorrectFormat(lmfsData.rawLogs);
    expect(result.solutionType).toBe("LMFS");
  });

  it("should correctly identify ODRD logs from a full data file", () => {
    const odrdData = loadTestData("jump-demo.json");
    const result = ensureCorrectFormat(odrdData.rawLogs);
    expect(result.solutionType).toBe("ODRD");
  });
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

// Your more realistic, real-world tests integrated here.
describe("ensureCorrectFormat realistic merge scenarios", () => {
  it("should merge basic restricted attributes", () => {
    const parentLog = {
      insertId: "parent",
      jsonPayload: { "@type": "type.googleapis.com/Normal", request: {}, response: {} },
    };
    const restrictedLog = {
      jsonPayload: {
        "@type": "type.googleapis.com/Restricted",
        parentInsertId: "parent",
        request: { waypoints: ["point1", "point2"] },
      },
    };

    const result = ensureCorrectFormat([parentLog, restrictedLog]);
    expect(result.rawLogs).toHaveLength(1);
    // Corrected to check the normalized key
    expect(result.rawLogs[0].jsonpayload.request.waypoints).toEqual(["point1", "point2"]);
  });

  it("should merge nested vehicle and trip restricted attributes", () => {
    const parentLog = {
      insertId: "parent",
      jsonPayload: {
        "@type": "type.googleapis.com/maps.fleetengine.v1.UpdateVehicleLog",
        request: { vehicle: { name: "test-vehicle" } },
        response: {},
      },
    };
    const restrictedLog = {
      jsonPayload: {
        "@type": "type.googleapis.com/maps.fleetengine.v1.UpdateVehicleRestrictedLog",
        parentInsertId: "parent",
        request: { vehicle: { currentRouteSegment: "testSegment123" } },
        response: {
          currentRouteSegment: "responseSegment456",
          waypoints: [{ encodedPathToWaypoint: "encodedPath789" }],
        },
      },
    };

    const result = ensureCorrectFormat([parentLog, restrictedLog]);
    const finalPayload = result.rawLogs[0].jsonpayload;

    expect(result.rawLogs).toHaveLength(1);
    // Corrected to check the normalized keys
    expect(finalPayload.request.vehicle.currentroutesegment).toBe("testSegment123");
    expect(finalPayload.response.currentroutesegment).toBe("responseSegment456");
    expect(finalPayload.response.waypoints[0].encodedpathtowaypoint).toBe("encodedPath789");
    expect(finalPayload.request.vehicle.name).toBe("test-vehicle");
  });
});

describe("ensureCorrectFormat TTL Logic", () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const FIFTY_FIVE_DAYS_MS = 55 * ONE_DAY_MS;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  it("should set retentionDate to Now + 1h for very old logs (Grace Period)", () => {
    const oldTimestamp = new Date(Date.now() - 100 * ONE_DAY_MS).toISOString();
    const mockLogs = [{ timestamp: oldTimestamp, jsonPayload: { test: 1 } }];
    const result = ensureCorrectFormat(mockLogs);

    const retention = new Date(result.retentionDate).getTime();
    const expectedMin = Date.now() + ONE_HOUR_MS;

    // Allow small delta for execution time
    expect(retention).toBeGreaterThanOrEqual(expectedMin - 1000);
    expect(retention).toBeLessThanOrEqual(expectedMin + 5000);
  });

  it("should set retentionDate to Log + 55d for recent logs", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * ONE_DAY_MS).getTime();
    const mockLogs = [{ timestamp: new Date(tenDaysAgo).toISOString(), jsonPayload: { test: 1 } }];
    const result = ensureCorrectFormat(mockLogs);

    const retention = new Date(result.retentionDate).getTime();
    const expected = tenDaysAgo + FIFTY_FIVE_DAYS_MS;

    expect(retention).toBe(expected);
  });

  it("should default to Now + 1h if no timestamps found", () => {
    const mockLogs = [{ jsonPayload: { no_timestamp: true } }];
    const result = ensureCorrectFormat(mockLogs);

    const retention = new Date(result.retentionDate).getTime();
    const expectedMin = Date.now() + ONE_HOUR_MS;

    expect(retention).toBeGreaterThanOrEqual(expectedMin - 1000);
    expect(retention).toBeLessThanOrEqual(expectedMin + 5000);
  });

  it("should store retentionDate as a valid ISO string", () => {
    const mockLogs = [{ timestamp: new Date().toISOString(), jsonPayload: { test: 1 } }];
    const result = ensureCorrectFormat(mockLogs);

    expect(typeof result.retentionDate).toBe("string");
    // Simple regex to check ISO format YYYY-MM-DDTHH:mm:ss.sssZ
    expect(result.retentionDate).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/);
  });

  it("should recalculate retentionDate on import, ignoring stale values in file", () => {
    // A file might include a retentionDate.
    const staleDate = new Date(Date.now() - 100 * ONE_DAY_MS).toISOString();
    const mockExportedFile = {
      rawLogs: [{ timestamp: new Date(Date.now() - 200 * ONE_DAY_MS).toISOString(), jsonPayload: { test: 1 } }],
      retentionDate: staleDate,
      APIKEY: "abc"
    };

    const result = ensureCorrectFormat(mockExportedFile);
    const retention = new Date(result.retentionDate).getTime();
    const expectedMin = Date.now() + ONE_HOUR_MS;

    expect(result.retentionDate).not.toBe(staleDate);
    expect(retention).toBeGreaterThanOrEqual(expectedMin - 1000);
  });
});
