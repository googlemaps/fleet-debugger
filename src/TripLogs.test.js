// src/TripLogs.test.js

import TripLogs from "./TripLogs";
import fs from "fs";
import _ from "lodash";

async function loadTripLogs(dataset) {
  const parsedData = JSON.parse(fs.readFileSync(dataset));
  return new TripLogs(parsedData.rawLogs, parsedData.solutionType);
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

test("lastKnownState location is correctly applied to subsequent logs", () => {
  // Create mock data with two log entries
  const mockLogs = [
    {
      timestamp: "2023-01-01T10:00:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            lastlocation: {
              location: { latitude: 37.7749, longitude: -122.4194 },
              heading: 90
            }
          }
        },
        response: {}
      }
    },
    {
      timestamp: "2023-01-01T10:01:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {}
        },
        response: {}
      }
    }
  ];

  const tripLogs = new TripLogs(mockLogs, "ODRD");
  
  // Check that the second log entry received the lastKnownState from the first
  expect(tripLogs.rawLogs[1].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[1].lastlocation.heading).toBe(90);
});

test("request and response objects are not mutated", () => {
  // Create a log with location data
  const originalLocation = { latitude: 37.7749, longitude: -122.4194 };
  const mockLog = {
    timestamp: "2023-01-01T10:00:00Z",
    jsonpayload: {
      "@type": "updateVehicle",
      request: {
        vehicle: {
          lastlocation: {
            location: originalLocation,
            heading: 90
          }
        }
      },
      response: {}
    }
  };

  const tripLogs = new TripLogs([mockLog], "ODRD");
  
  // Verify the original request object was not modified
  expect(tripLogs.rawLogs[0].request.vehicle.lastlocation.location).not.toBe(originalLocation);
  
  // But the data is still equal
  expect(tripLogs.rawLogs[0].request.vehicle.lastlocation.location).toEqual(originalLocation);
  
  // Modify the synthetic field
  tripLogs.rawLogs[0].lastlocation.location.latitude = 38.0;
  
  // Verify the original was not affected
  expect(tripLogs.rawLogs[0].request.vehicle.lastlocation.location).toEqual(originalLocation);
});

test("lastKnownState route segments are reset with NO_GUIDANCE", () => {
  // Create mock data with three log entries
  const mockLogs = [
    {
      timestamp: "2023-01-01T10:00:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            currentroutesegment: { id: "segment1", path: [{ latitude: 37.7, longitude: -122.4 }] },
            currentroutesegmenttraffic: { speed: 30 }
          }
        },
        response: {}
      }
    },
    {
      timestamp: "2023-01-01T10:01:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            navstatus: "NAVIGATION_STATUS_NO_GUIDANCE"
          }
        },
        response: {}
      }
    },
    {
      timestamp: "2023-01-01T10:02:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {}
        },
        response: {}
      }
    }
  ];

  const tripLogs = new TripLogs(mockLogs, "ODRD");
  
  // First log should have the route segment
  expect(tripLogs.rawLogs[0].lastlocation.currentroutesegment).toBeDefined();
  
  // Second log sets navstatus to NO_GUIDANCE, so lastKnownState should be reset
  expect(tripLogs.rawLogs[1].lastlocation.currentroutesegment).not.toBeDefined();
  
  // Third log should not have route segment since it was reset
  expect(tripLogs.rawLogs[2].lastlocation.currentroutesegment).not.toBeDefined();
});

test("lastKnownState is properly propagated through a sequence of logs", () => {
  // Create a sequence of logs with varying data
  const mockLogs = [
    {
      // Log 1: Has location but no route
      timestamp: "2023-01-01T10:00:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            lastlocation: {
              location: { latitude: 37.7749, longitude: -122.4194 },
              heading: 90
            }
          }
        },
        response: {}
      }
    },
    {
      // Log 2: Has route but no location
      timestamp: "2023-01-01T10:01:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {
            currentroutesegment: { id: "segment1", path: [{ latitude: 37.7, longitude: -122.4 }] }
          }
        },
        response: {}
      }
    },
    {
      // Log 3: Has neither location nor route
      timestamp: "2023-01-01T10:02:00Z",
      jsonpayload: {
        "@type": "updateVehicle",
        request: {
          vehicle: {}
        },
        response: {}
      }
    }
  ];

  const tripLogs = new TripLogs(mockLogs, "ODRD");
  
  // Log 1: Should have location but no route
  expect(tripLogs.rawLogs[0].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[0].lastlocation.currentroutesegment).not.toBeDefined();
  
  // Log 2: Should have location from Log 1 and its own route
  expect(tripLogs.rawLogs[1].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[1].lastlocation.currentroutesegment).toBeDefined();
  
  // Log 3: Should have both location from Log 1 and route from Log 2
  expect(tripLogs.rawLogs[2].lastlocation.location).toEqual({ latitude: 37.7749, longitude: -122.4194 });
  expect(tripLogs.rawLogs[2].lastlocation.currentroutesegment).toBeDefined();
});
