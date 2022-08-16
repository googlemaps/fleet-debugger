import TripLogs from "./TripLogs";
import TaskLogs from "./TaskLogs";
import fs from "fs";

function haversineDistanceMeters(coords1, coords2) {
  function toRad(x) {
    return (x * Math.PI) / 180;
  }

  let lat1 = coords1.lat;
  let lon1 = coords1.lng;

  let lat2 = coords2.lat;
  let lon2 = coords2.lng;

  let R = 6371; // km

  let x1 = lat2 - lat1;
  let dLat = toRad(x1);
  let x2 = lon2 - lon1;
  let dLon = toRad(x2);
  let a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let d = R * c;

  return d * 1000.0;
}

// mock maps js sdk
window.google = {
  maps: {
    geometry: {
      spherical: {
        computeDistanceBetween: haversineDistanceMeters,
      },
    },
  },
};

async function loadTripLogs(dataset) {
  const parsedData = JSON.parse(fs.readFileSync(dataset));
  const tripLogs = new TripLogs(parsedData.rawLogs, parsedData.solutionType);
  return new TaskLogs(tripLogs);
}

test("basic lmfs task log loading", async () => {
  const taskLogs = await loadTripLogs("./datasets/lmfs.json");

  expect(taskLogs.getTasks().map("taskid").value()).toStrictEqual([
    "task_0_1_sample-vehicle-id",
    "task_1_1_sample-vehicle-id",
    "task_2_1_sample-vehicle-id",
    "task_3_1_sample-vehicle-id",
    "task_4_1_sample-vehicle-id",
    "task_5_1_sample-vehicle-id",
    "task_6_1_sample-vehicle-id",
    "task_7_1_sample-vehicle-id",
    "task_8_1_sample-vehicle-id",
    "task_9_1_sample-vehicle-id",
    "task_return_to_depot_sample-vehicle-id",
  ]);

  // The undefined values are the tasks that the driver
  // didn't even get to
  expect(taskLogs.getTasks().map("taskoutcome").value()).toStrictEqual([
    "TASK_OUTCOME_LOG_SUCCEEDED",
    "TASK_OUTCOME_LOG_SUCCEEDED",
    "TASK_OUTCOME_LOG_SUCCEEDED",
    "TASK_OUTCOME_LOG_SUCCEEDED",
    undefined,
    "TASK_OUTCOME_LOG_SUCCEEDED",
    undefined,
    "TASK_OUTCOME_LOG_SUCCEEDED",
    undefined,
    "TASK_OUTCOME_LOG_FAILED",
    "TASK_OUTCOME_LOG_SUCCEEDED",
  ]);

  // Verify that the computation of the delta between planned vs actual
  // stop results in something somewhat plausible (rouding to closest
  // integer to avoid any floating point strangeness).
  expect(
    taskLogs
      .getTasks()
      .map(
        (t) =>
          t.plannedVsActualDeltaMeters && parseInt(t.plannedVsActualDeltaMeters)
      )
      .value()
  ).toStrictEqual([
    43,
    57,
    40,
    21,
    undefined,
    283,
    undefined,
    25,
    undefined,
    30,
    108,
  ]);
});

test("fleet archive lmfs task log loading", async () => {
  const taskLogs = await loadTripLogs("./datasets/fleet_archive_delivery.json");

  expect(taskLogs.getTasks().map("taskid").value()).toStrictEqual([
    "sample-vehicle-id-1",
    "sample-vehicle-id-2",
  ]);

  expect(taskLogs.getTasks().map("taskoutcome").value()).toStrictEqual([
    "SUCCEEDED",
    undefined,
  ]);

  expect(
    taskLogs
      .getTasks()
      .map(
        (t) =>
          t.plannedVsActualDeltaMeters && parseInt(t.plannedVsActualDeltaMeters)
      )
      .value()
  ).toStrictEqual([0, undefined]);
});
