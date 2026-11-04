// src/CloudLogging.test.js
import { buildQueryFilter, useCloudLoggingLogin, fetchLogsWithToken } from "./CloudLogging";
import { useGoogleLogin, hasGrantedAnyScopeGoogle } from "@react-oauth/google";

jest.mock("@react-oauth/google", () => ({
  useGoogleLogin: jest.fn(),
  hasGrantedAnyScopeGoogle: jest.fn(),
}));

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

describe("useCloudLoggingLogin", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  test("rejects tokens when hasGrantedAnyScopeGoogle returns false and does not save token to sessionStorage", () => {
    let capturedConfig;
    useGoogleLogin.mockImplementation((config) => {
      capturedConfig = config;
      return jest.fn();
    });
    hasGrantedAnyScopeGoogle.mockReturnValue(false);

    sessionStorage.setItem("cloudLogging_token", "stale-token");
    sessionStorage.setItem("cloudLogging_token_expiry", "9999999999999");

    const onSuccess = jest.fn();
    const onError = jest.fn();

    useCloudLoggingLogin(onSuccess, onError);

    capturedConfig.onSuccess({
      access_token: "unscoped-token",
      expires_in: 3600,
      scope: "email profile",
    });

    expect(hasGrantedAnyScopeGoogle).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: "unscoped-token" }),
      "https://www.googleapis.com/auth/logging.read",
      "https://www.googleapis.com/auth/cloud-platform.read-only"
    );
    expect(sessionStorage.getItem("cloudLogging_token")).toBeNull();
    expect(sessionStorage.getItem("cloudLogging_token_expiry")).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith({
      error: "Missing required Cloud Logging OAuth permission. Please check the permission box when signing in.",
    });
  });

  test("saves token to sessionStorage and calls onSuccess when required scope is granted", () => {
    let capturedConfig;
    useGoogleLogin.mockImplementation((config) => {
      capturedConfig = config;
      return jest.fn();
    });
    hasGrantedAnyScopeGoogle.mockReturnValue(true);

    const onSuccess = jest.fn();
    const onError = jest.fn();

    useCloudLoggingLogin(onSuccess, onError);

    capturedConfig.onSuccess({
      access_token: "valid-token",
      expires_in: 3600,
      scope: "https://www.googleapis.com/auth/logging.read",
    });

    expect(sessionStorage.getItem("cloudLogging_token")).toBe("valid-token");
    expect(sessionStorage.getItem("cloudLogging_token_expiry")).not.toBeNull();
    expect(onSuccess).toHaveBeenCalledWith("valid-token");
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("fetchLogsWithToken insufficient scope handling", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("clears sessionStorage and throws insufficient-scope error on 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT", async () => {
    sessionStorage.setItem("cloudLogging_token", "revoked-scope-token");
    sessionStorage.setItem("cloudLogging_token_expiry", (Date.now() + 3600000).toString());

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 403,
          message: "Request had insufficient authentication scopes.",
          status: "PERMISSION_DENIED",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.ErrorInfo",
              reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
              domain: "googleapis.com",
            },
          ],
        },
      }),
    });

    const queryParams = {
      projectId: "test-project",
      vehicleId: "vehicle1",
      tripIds: "",
      startTime: "",
      endTime: "",
    };

    await expect(fetchLogsWithToken("revoked-scope-token", queryParams, null, jest.fn())).rejects.toThrow(
      "INSUFFICIENT_OAUTH_SCOPES: Request had insufficient authentication scopes."
    );

    expect(sessionStorage.getItem("cloudLogging_token")).toBeNull();
    expect(sessionStorage.getItem("cloudLogging_token_expiry")).toBeNull();
  });
});
