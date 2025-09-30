// src/MapToggles.test.js
import { getVisibleToggles, ALL_TOGGLES } from "./MapToggles";

describe("getVisibleToggles", () => {
  test('should return ODRD and common toggles for "ODRD" solution type', () => {
    const solutionType = "ODRD";
    const visibleToggles = getVisibleToggles(solutionType);

    // Manually check for a toggle that is ODRD-only
    expect(visibleToggles.some((t) => t.id === "showTripStatus")).toBe(true);
    // Manually check for a toggle that is NOT for ODRD
    expect(visibleToggles.some((t) => t.id === "showTasksAsCreated")).toBe(false);

    // Compare against the master list for accuracy
    const expectedToggles = ALL_TOGGLES.filter((t) => t.solutionTypes.includes("ODRD"));
    expect(visibleToggles).toHaveLength(expectedToggles.length);

    const visibleToggleIds = visibleToggles.map((t) => t.id);
    const expectedToggleIds = expectedToggles.map((t) => t.id);
    expect(visibleToggleIds).toEqual(expect.arrayContaining(expectedToggleIds));
  });

  test('should return LMFS and common toggles for "LMFS" solution type', () => {
    const solutionType = "LMFS";
    const visibleToggles = getVisibleToggles(solutionType);

    // Manually check for a toggle that is LMFS-only
    expect(visibleToggles.some((t) => t.id === "showTasksAsCreated")).toBe(true);
    // Manually check for a toggle that is NOT for LMFS
    expect(visibleToggles.some((t) => t.id === "showTripStatus")).toBe(false);

    const expectedToggles = ALL_TOGGLES.filter((t) => t.solutionTypes.includes("LMFS"));
    expect(visibleToggles).toHaveLength(expectedToggles.length);

    const visibleToggleIds = visibleToggles.map((t) => t.id);
    const expectedToggleIds = expectedToggles.map((t) => t.id);
    expect(visibleToggleIds).toEqual(expect.arrayContaining(expectedToggleIds));
  });

  test("should return an empty array for an unknown solution type", () => {
    const solutionType = "UNKNOWN_TYPE";
    const visibleToggles = getVisibleToggles(solutionType);
    expect(visibleToggles).toEqual([]);
    expect(visibleToggles).toHaveLength(0);
  });

  test("should return an empty array for null or undefined solution type", () => {
    expect(getVisibleToggles(null)).toEqual([]);
    expect(getVisibleToggles(undefined)).toEqual([]);
  });
});
