import TripLogs from "./TripLogs";
import fs from "fs";

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
    "Stops Left 10",
    "Stops Left 9",
    "Stops Left 8",
    "Stops Left 7",
    "Stops Left 6",
    "Stops Left 5",
    "Stops Left 4",
    "Stops Left 3",
    "Stops Left 2",
    "Stops Left 1",
  ]);
});
