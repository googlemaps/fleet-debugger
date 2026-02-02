// src/CloudLogging.test.js
import { buildQueryFilter } from "./CloudLogging";

describe("buildQueryFilter", () => {
  test("builds filter with vehicle ID only", () => {
    const params = {
      projectId: "test-project",
      vehicleId: "vehicle1",
      tripIds: "",
      startTime: "2023-01-01T01:00:00",
      endTime: "2023-01-02T02:00:00",
    };

    const filter = buildQueryFilter(params);

    // Check for key components in the filter
    expect(filter).toContain(
      '(resource.type="fleetengine.googleapis.com/Fleet" OR resource.type="fleetengine.googleapis.com/DeliveryFleet")'
    );
    expect(filter).toContain('(labels.vehicle_id="vehicle1" OR labels.delivery_vehicle_id="vehicle1")');
    expect(filter).toContain("2023-01-01T01:00:00");
    expect(filter).toContain("2023-01-02T02:00:00");
  });

  test("builds filter with trip IDs only", () => {
    const params = {
      projectId: "test-project",
      vehicleId: "",
      tripIds: "trip1,trip2",
      startTime: "",
      endTime: "",
    };

    const filter = buildQueryFilter(params);

    // Should include regex for multiple trip IDs and verify task_id is included
    expect(filter).toContain('(labels.trip_id=~"(trip1|trip2)" OR labels.task_id=~"(trip1|trip2)")');
  });

  test("builds filter with single trip ID", () => {
    const params = {
      projectId: "test-project",
      vehicleId: "",
      tripIds: "trip1",
      startTime: "",
      endTime: "",
    };

    const filter = buildQueryFilter(params);

    // Should use exact match for single trip ID and verify task_id is included
    expect(filter).toContain('(labels.trip_id="trip1" OR labels.task_id="trip1")');
  });

  test("builds filter with both vehicle and trip IDs", () => {
    const params = {
      projectId: "test-project",
      vehicleId: "vehicle1",
      tripIds: "trip1,trip2",
      startTime: "",
      endTime: "",
    };

    const filter = buildQueryFilter(params);

    // Should combine vehicle and trip filters with OR
    expect(filter).toContain(
      '((labels.vehicle_id="vehicle1" OR labels.delivery_vehicle_id="vehicle1") OR (labels.trip_id=~"(trip1|trip2)" OR labels.task_id=~"(trip1|trip2)"))'
    );
  });

  test("throws error for missing project ID", () => {
    const params = {
      projectId: "",
      vehicleId: "vehicle1",
    };

    expect(() => buildQueryFilter(params)).toThrow("Project ID is required");
  });

  test("throws error when both vehicle ID and trip IDs are missing", () => {
    const params = {
      projectId: "test-project",
      vehicleId: "",
      tripIds: "",
    };

    expect(() => buildQueryFilter(params)).toThrow("Either Vehicle ID or at least one Trip ID must be specified");
  });
});
