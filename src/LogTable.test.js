// src/LogTable.test.js
import {
  getTooltipText,
  parseTimestamp,
  formatDateAndTime,
  formatFriendlyDuration,
  getBaseTimeForDuration,
  formatValue,
  getColumnCategory,
} from "./LogTable";

describe("parseTimestamp", () => {
  test("should parse a valid ISO UTC timestamp string correctly", () => {
    const ts = "2026-04-30T06:50:35.454Z";
    const date = parseTimestamp(ts);
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe("2026-04-30T06:50:35.454Z");
  });

  test("should automatically append 'Z' to force UTC parsing for timezone-naive ISO strings", () => {
    const ts = "2026-04-30T06:50:35.454";
    const date = parseTimestamp(ts);
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe("2026-04-30T06:50:35.454Z");
  });

  test("should preserve timezone offset if explicitly supplied", () => {
    const ts = "2026-04-30T06:50:35.454-07:00";
    const date = parseTimestamp(ts);
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe("2026-04-30T13:50:35.454Z");
  });

  test("should handle whitespace trimmed strings", () => {
    const ts = "   2026-04-30T06:50:35.454Z   ";
    const date = parseTimestamp(ts);
    expect(date.toISOString()).toBe("2026-04-30T06:50:35.454Z");
  });

  test("should pass through existing Date instances", () => {
    const original = new Date("2026-04-30T06:50:35.000Z");
    const date = parseTimestamp(original);
    expect(date).toBe(original);
  });

  test("should return null for null, empty, undefined or invalid strings", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("not-a-date")).toBeNull();
  });
});

describe("formatDateAndTime", () => {
  test("should format a date to UTC MM-DD HH:MM:SS format", () => {
    const date = new Date("2026-04-30T06:50:35.454Z");
    expect(formatDateAndTime(date)).toBe("04-30 06:50:35");
  });

  test("should pad small numbers with a leading zero", () => {
    const date = new Date("2026-01-05T03:04:09.000Z");
    expect(formatDateAndTime(date)).toBe("01-05 03:04:09");
  });

  test("should return an empty string for falsy dates", () => {
    expect(formatDateAndTime(null)).toBe("");
  });
});

describe("formatFriendlyDuration", () => {
  test("should format durations under a minute with trailing 's'", () => {
    expect(formatFriendlyDuration(45)).toBe("45s");
    expect(formatFriendlyDuration(0)).toBe("0s");
  });

  test("should format durations over a minute into readable minutes and seconds", () => {
    expect(formatFriendlyDuration(741)).toBe("12m 21s");
    expect(formatFriendlyDuration(60)).toBe("1m 0s");
  });

  test("should handle negative durations correctly", () => {
    expect(formatFriendlyDuration(-45)).toBe("-45s");
    expect(formatFriendlyDuration(-741)).toBe("-12m 21s");
  });
});

describe("getBaseTimeForDuration", () => {
  test("should look up proper nested vehicle location update paths inside request blocks first", () => {
    const row = {
      request: {
        vehicle: {
          lastlocation: {
            updatetime: "2026-04-30T06:33:40.000Z",
          },
        },
      },
      formattedDate: "2026-04-30T06:35:00.000Z",
    };
    const baseTime = getBaseTimeForDuration(row, "request.vehicle.remainingtimeseconds");
    expect(baseTime.toISOString()).toBe("2026-04-30T06:33:40.000Z");
  });

  test("should look up delivery vehicle path for LMFS requests", () => {
    const row = {
      request: {
        deliveryvehicle: {
          lastlocation: {
            updatetime: "2026-04-30T06:33:40.000Z",
          },
        },
      },
    };
    const baseTime = getBaseTimeForDuration(row, "request.deliveryvehicle.remainingtimeseconds");
    expect(baseTime.toISOString()).toBe("2026-04-30T06:33:40.000Z");
  });

  test("should fallback to top-level formattedDate or timestamp if request path has no valid target", () => {
    const row = {
      request: {
        vehicle: {},
      },
      formattedDate: "2026-04-30T06:35:00.000Z",
    };
    const baseTime = getBaseTimeForDuration(row, "request.vehicle.remainingtimeseconds");
    expect(baseTime.toISOString()).toBe("2026-04-30T06:35:00.000Z");
  });

  test("should return null if no timestamp targets can be parsed", () => {
    const row = { request: {} };
    expect(getBaseTimeForDuration(row, "request.vehicle.remainingtimeseconds")).toBeNull();
  });
});

describe("getColumnCategory", () => {
  test("should return null for standard DayTime column (formattedDate) or keyword daytime", () => {
    expect(getColumnCategory("formattedDate", "2026-04-30T06:50:35Z")).toBeNull();
    expect(getColumnCategory("DayTime", "2026-04-30T06:50:35Z")).toBeNull();
    expect(getColumnCategory("daytime", "2026-04-30T06:50:35Z")).toBeNull();
  });

  test("should return 'timestamp' for path names or ISO value samples matching timestamp conditions", () => {
    expect(getColumnCategory("request.vehicle.lastlocation.updatetime", "2026-04-30T06:33:40.045Z")).toBe("timestamp");
    expect(getColumnCategory("response.servertime", "2026-04-30T06:33:40Z")).toBe("timestamp");
    expect(getColumnCategory("response.remainingwaypointsversion", "2026-04-30T06:33:40.045Z")).toBe("timestamp");
    expect(getColumnCategory("custom.timestamp", "2026-04-30T06:33:40.045Z")).toBe("timestamp");
  });

  test("should return 'duration' for numeric value samples and path names containing duration keywords", () => {
    expect(getColumnCategory("request.vehicle.remainingtimeseconds", 741)).toBe("duration");
    expect(getColumnCategory("response.duration", "120")).toBe("duration");
    expect(getColumnCategory("custom.remainingtime", 30.5)).toBe("duration");
  });

  test("should return 'distance' for numeric value samples and path names containing distance/meters keywords", () => {
    expect(getColumnCategory("request.deliveryvehicle.remainingdistancemeters", 15420)).toBe("distance");
    expect(getColumnCategory("response.distance", "154.2")).toBe("distance");
    expect(getColumnCategory("custom.meters", 5000)).toBe("distance");
  });

  test("should return null for standard non-formattable properties", () => {
    expect(getColumnCategory("Method", "updateVehicle")).toBeNull();
    expect(getColumnCategory("Kmph", 45)).toBeNull();
    expect(getColumnCategory("Sensor", "LOCATION_SENSOR_GPS")).toBeNull();
  });
});

describe("formatValue", () => {
  test("should correctly format timestamp states", () => {
    const val = "2026-04-30T06:50:35.000Z";
    expect(formatValue(val, "timestamp", 0, null, "path")).toBe(val);
    expect(formatValue(val, "timestamp", 1, null, "path")).toBe("04-30 06:50:35");
  });

  test("should correctly format duration states", () => {
    const row = {
      request: {
        vehicle: {
          lastlocation: {
            updatetime: "2026-04-30T06:33:40.000Z",
          },
        },
      },
    };
    expect(formatValue(741, "duration", 0, row, "request.vehicle.remainingtimeseconds")).toBe("741");
    // State 1: ETA Clock Time (06:33:40 + 741s = 06:46:01)
    expect(formatValue(741, "duration", 1, row, "request.vehicle.remainingtimeseconds")).toBe("04-30 06:46:01");
    // State 2: Friendly Duration
    expect(formatValue(741, "duration", 2, row, "request.vehicle.remainingtimeseconds")).toBe("12m 21s");
  });

  test("should correctly format distance states", () => {
    expect(formatValue(15420, "distance", 0, null, "path")).toBe("15420");
    expect(formatValue(15420, "distance", 1, null, "path")).toBe("15.42 km");
    expect(formatValue(15420, "distance", 2, null, "path")).toBe("9.58 mi");
  });
});

describe("getTooltipText", () => {
  test("should return valid tooltip context cycles for all categories", () => {
    expect(getTooltipText("timestamp", 0)).toContain("Original Timestamp");
    expect(getTooltipText("duration", 1)).toContain("Clock Time ETA");
    expect(getTooltipText("distance", 2)).toContain("Miles");
    expect(getTooltipText("unknown", 0)).toBe("");
  });
});
