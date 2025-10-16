// src/TripLogs.test.js

import TripLogs from "./TripLogs";
import fs from "fs";
import _ from "lodash";
import { ensureCorrectFormat } from "./localStorage";

async function loadTripLogs(dataset) {
  const fileContent = fs.readFileSync(dataset, "utf8");
  const jsonData = JSON.parse(fileContent);
  const formattedData = ensureCorrectFormat(jsonData);
  return new TripLogs(formattedData.rawLogs, formattedData.solutionType);
}

test("basic odrd trip log loading", async () => {
  const tripLogs = await loadTripLogs("./datasets/jump-demo.json");

  expect(tripLogs.getTripIDs()).toStrictEqual([
    "non-trip-segment-0",
    "a51c8f15-47c0-4bae-8262-8421b0a3e058",
    "non-trip-segment-1",
    "2f03ff03-1d0e-49e2-91d4-f3c674d98073",
    "non-trip-segment-2",
    "d9d7686f-0dd2-4114-a1e2-ae11201d4c0f",
    "non-trip-segment-3",
    "73a320f8-0e1f-44cb-ba99-cdad010cdaf4",
    "non-trip-segment-4",
  ]);
});

test("basic lmfs trip log loading", async () => {
  const tripLogs = await loadTripLogs("./datasets/lmfs.json");

  expect(tripLogs.getTripIDs()).toStrictEqual([
    "Stops Left 11",
    "Stops Left 10",
    "Stops Left 9",
    "Stops Left 8",
    "Stops Left 7",
    "Stops Left 6",
    "Stops Left 5",
    "Stops Left 4",
    "Stops Left 3",
  ]);
});

describe("Filtering", () => {
  let tripLogs;

  beforeAll(async () => {
    tripLogs = await loadTripLogs("./datasets/two-trips-bay-area.json");
  });

  test("filters by a single log type", () => {
    const filters = { logTypes: { createTrip: true } };
    const logs = tripLogs.getLogs_(null, null, filters).value();
    expect(logs.every((log) => log["@type"] === "createTrip")).toBe(true);
    expect(logs.length).toBe(2);
  });

  test("filters by multiple log types", () => {
    const filters = { logTypes: { updateVehicle: true, createTrip: true } };
    const logs = tripLogs.getLogs_(null, null, filters).value();
    const types = new Set(logs.map((log) => log["@type"]));
    expect(types.has("updateVehicle")).toBe(true);
    expect(types.has("createTrip")).toBe(true);
    expect(logs.length).toBe(530);
  });

  test("returns no logs for a non-matching filter", () => {
    const filters = { logTypes: { nonExistentType: true } };
    const noLogs = tripLogs.getLogs_(null, null, filters).value();
    expect(noLogs.length).toBe(0);
  });

  test("filters by a full trip ID", () => {
    const tripId = "fb1318df-9a2e-4455-9b17-3a7433a681e4";
    const filters = { tripId: tripId };
    const logs = tripLogs.getLogs_(null, null, filters).value();
    expect(logs.length).toBe(251);
    const isRelated = logs.every(
      (log) =>
        _.get(log, "request.tripid") === tripId || _.get(log, "response.currenttrips", []).includes(tripId)
    );
    expect(isRelated).toBe(true);
  });

  test("filters by a partial trip ID", () => {
    const partialId = "fb1318df";
    const filters = { tripId: partialId };
    const logs = tripLogs.getLogs_(null, null, filters).value();
    expect(logs.length).toBe(251);
  });

  test("returns no logs for a non-existent trip ID", () => {
    const filters = { tripId: "non-existent-trip" };
    const logs = tripLogs.getLogs_(null, null, filters).value();
    expect(logs.length).toBe(0);
  });

  test("combines log type and trip ID filters", () => {
    const filters = {
      logTypes: { updateVehicle: true },
      tripId: "fb1318df-9a2e-4455-9b17-3a7433a681e4",
    };
    const logs = tripLogs.getLogs_(null, null, filters).value();
    expect(logs.length).toBe(244);
    expect(logs.every((log) => log["@type"] === "updateVehicle")).toBe(true);
  });
});

describe("Location Data Processing", () => {
  test("LMFS log populates .location from .rawlocation as a fallback", () => {
    const rawLocation = { latitude: 37.422, longitude: -122.084 };
    const mockLogs = [
      {
        timestamp: "2023-01-01T12:00:00Z",
        jsonPayload: {
          "@type": "updateDeliveryVehicle",
          request: {
            deliveryvehicle: {
              lastlocation: {
                rawlocation: rawLocation,
              },
            },
          },
          response: {},
        },
      },
    ];

    const formattedData = ensureCorrectFormat(mockLogs);
    const tripLogs = new TripLogs(formattedData.rawLogs, "LMFS");
    expect(tripLogs.rawLogs[0].lastlocation.location).toEqual(rawLocation);
  });

  test("ODRD log with both location and rawlocation prefers location", () => {
    const snappedLocation = { latitude: 37.7749, longitude: -122.4194 };
    const rawLocation = { latitude: 37.775, longitude: -122.4195 };
    const mockLogs = [
      {
        timestamp: "2023-01-01T10:00:00Z",
        jsonPayload: {
          "@type": "updateVehicle",
          request: {
            vehicle: {
              lastlocation: {
                location: snappedLocation,
                rawlocation: rawLocation,
              },
            },
          },
          response: {},
        },
      },
    ];

    const formattedData = ensureCorrectFormat(mockLogs);
    const tripLogs = new TripLogs(formattedData.rawLogs, "ODRD");
    expect(tripLogs.rawLogs[0].lastlocation.location).toEqual(snappedLocation);
    expect(tripLogs.rawLogs[0].lastlocation.location).not.toEqual(rawLocation);
  });

  test("lastKnownState propagates location from an LMFS rawlocation", () => {
    const rawLocation = { latitude: 37.422, longitude: -122.084 };
    const mockLogs = [
      {
        timestamp: "2023-01-01T12:00:00Z",
        jsonPayload: {
          "@type": "updateDeliveryVehicle",
          request: {
            deliveryvehicle: {
              lastlocation: {
                rawlocation: rawLocation,
                heading: 180,
              },
            },
          },
          response: {},
        },
      },
      {
        timestamp: "2023-01-01T12:01:00Z",
        jsonPayload: {
          "@type": "updateDeliveryVehicle",
          request: {
            deliveryvehicle: {},
          },
          response: {},
        },
      },
    ];
    const formattedData = ensureCorrectFormat(mockLogs);
    const tripLogs = new TripLogs(formattedData.rawLogs, "LMFS");
    expect(tripLogs.rawLogs[1].lastlocation.location).toEqual(rawLocation);
    expect(tripLogs.rawLogs[1].lastlocation.heading).toBe(180);
  });
});

test("lastKnownState location is correctly applied to subsequent logs", () => {
  const mockLogs = [
    {
      timestamp: "2023-01-01T10:00:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            lastlocation: {
              location: { latitude: 37.7749, longitude: -122.4194 },
              heading: 90,
            },
          },
        },
        response: {},
      },
    },
    {
      timestamp: "2023-01-01T10:01:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {},
        },
        response: {},
      },
    },
  ];

  const formattedData = ensureCorrectFormat(mockLogs);
  const tripLogs = new TripLogs(formattedData.rawLogs, "ODRD");

  expect(tripLogs.rawLogs[1].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[1].lastlocation.heading).toBe(90);
});

test("request and response objects are not mutated", () => {
  const originalLocation = { latitude: 37.7749, longitude: -122.4194 };
  const mockLog = {
    timestamp: "2023-01-01T10:00:00Z",
    jsonPayload: {
      "@type": "updateVehicle",
      request: {
        vehicle: {
          lastlocation: {
            location: originalLocation,
            heading: 90,
          },
        },
      },
      response: {},
    },
  };

  const formattedData = ensureCorrectFormat([mockLog]);
  const tripLogs = new TripLogs(formattedData.rawLogs, "ODRD");

  expect(tripLogs.rawLogs[0].request.vehicle.lastlocation.location).not.toBe(originalLocation);
  expect(tripLogs.rawLogs[0].request.vehicle.lastlocation.location).toEqual(originalLocation);

  tripLogs.rawLogs[0].lastlocation.location.latitude = 38.0;

  expect(tripLogs.rawLogs[0].request.vehicle.lastlocation.location).toEqual(originalLocation);
});

test("lastKnownState route segments are reset with NO_GUIDANCE", () => {
  const mockLogs = [
    {
      timestamp: "2023-01-01T10:00:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            currentroutesegment: { id: "segment1", path: [{ latitude: 37.7, longitude: -122.4 }] },
            currentroutesegmenttraffic: { speed: 30 },
          },
        },
        response: {},
      },
    },
    {
      timestamp: "2023-01-01T10:01:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            navstatus: "NAVIGATION_STATUS_NO_GUIDANCE",
          },
        },
        response: {},
      },
    },
    {
      timestamp: "2023-01-01T10:02:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {},
        },
        response: {},
      },
    },
  ];

  const formattedData = ensureCorrectFormat(mockLogs);
  const tripLogs = new TripLogs(formattedData.rawLogs, "ODRD");

  expect(tripLogs.rawLogs[0].lastlocation.currentroutesegment).toBeDefined();
  expect(tripLogs.rawLogs[1].lastlocation.currentroutesegment).not.toBeDefined();
  expect(tripLogs.rawLogs[2].lastlocation.currentroutesegment).not.toBeDefined();
});

test("lastKnownState is properly propagated through a sequence of logs", () => {
  const mockLogs = [
    {
      timestamp: "2023-01-01T10:00:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            lastlocation: {
              location: { latitude: 37.7749, longitude: -122.4194 },
              heading: 90,
            },
          },
        },
        response: {},
      },
    },
    {
      timestamp: "2023-01-01T10:01:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            currentroutesegment: { id: "segment1", path: [{ latitude: 37.7, longitude: -122.4 }] },
          },
        },
        response: {},
      },
    },
    {
      timestamp: "2023-01-01T10:02:00Z",
      jsonPayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {},
        },
        response: {},
      },
    },
  ];

  const formattedData = ensureCorrectFormat(mockLogs);
  const tripLogs = new TripLogs(formattedData.rawLogs, "ODRD");

  expect(tripLogs.rawLogs[0].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[0].lastlocation.currentroutesegment).not.toBeDefined();

  expect(tripLogs.rawLogs[1].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[1].lastlocation.currentroutesegment).toBeDefined();

  expect(tripLogs.rawLogs[2].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[2].lastlocation.currentroutesegment).toBeDefined();
});
