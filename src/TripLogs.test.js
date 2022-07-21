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

test("fleet archive odrd trip log loading", async () => {
  const tripLogs = await loadTripLogs(
    "./datasets/fleet_archive_multitrip.json"
  );

  expect(tripLogs.getTripIDs()).toStrictEqual([
    "non-trip-segment-0",
    "2912e2cf-6bc8-4543-bd76-263621f8158a",
    "non-trip-segment-1",
    "1cb6d20b-4f70-4be0-a234-97180ba6132a",
    "1cb6d20b-4f70-4be0-a234-97180ba6132a,bb2a8a69-af09-4bc2-9279-8c2c10097fa5",
    "bb2a8a69-af09-4bc2-9279-8c2c10097fa5",
    "non-trip-segment-2",
    "bd531156-b5d7-4050-a8cf-73d1f579c6ea",
    "bd531156-b5d7-4050-a8cf-73d1f579c6ea,cd978137-887d-43d2-bc1a-cf1b8c95d82a",
    "cd978137-887d-43d2-bc1a-cf1b8c95d82a",
    "non-trip-segment-3",
    "e3a141ff-6ea1-450b-9ce0-978ed7d57a75",
    "non-trip-segment-4",
    "e926e55b-fbef-43a8-b3b3-861e183a0603",
    "non-trip-segment-5",
    "da252d3a-89c6-44c3-a320-2866f72ca90a",
    "non-trip-segment-6",
    "2928db32-7036-4f37-b217-548b079f94d0,9701ce36-e6e7-408a-ac66-9445fb8d8dc9",
    "9701ce36-e6e7-408a-ac66-9445fb8d8dc9",
    "non-trip-segment-7",
    "60133a38-5e95-452e-9b0e-9d0de3f694ad",
    "non-trip-segment-8",
    "d51fc19a-53e6-4cee-ba84-352186cd0084",
    "non-trip-segment-9",
    "231ce942-484c-441a-9361-7e9db86f0cec",
    "231ce942-484c-441a-9361-7e9db86f0cec,c82ef8a1-c37c-4095-bb7f-3f666136d173",
    "c82ef8a1-c37c-4095-bb7f-3f666136d173",
    "non-trip-segment-10",
    "c2313511-eb6d-47f6-bf00-92751021d1fd",
    "c2313511-eb6d-47f6-bf00-92751021d1fd,f4970f54-336a-4fa9-9ea8-f7d324b54f4e",
    "f4970f54-336a-4fa9-9ea8-f7d324b54f4e",
    "non-trip-segment-11",
    "0209951f-8876-4f24-a19a-81ce79bb4d9a",
    "non-trip-segment-12",
    "0c642ab0-39cb-43e3-8cd0-e39499b1c2cd",
    "non-trip-segment-13",
    "8d7938db-719c-47e2-af97-9a2f01a1572e",
    "non-trip-segment-14",
    "09545ee5-b3cf-4e67-9b58-6ef5b44d93c1",
    "non-trip-segment-15",
    "ccc2ff95-d9f0-4ec8-86af-b4533c8eb51d",
    "ccc2ff95-d9f0-4ec8-86af-b4533c8eb51d,d917ff95-a0a3-4f01-bef5-97b588638b89",
    "d917ff95-a0a3-4f01-bef5-97b588638b89",
    "non-trip-segment-16",
    "6ba917c7-e1a0-41a7-90b0-3e64bed7fa96",
    "non-trip-segment-17",
    "858c3076-f601-452e-8ab9-3759d185ec47",
    "non-trip-segment-18",
    "1f5d322a-ca1d-4a5f-93e9-3276fae7d0c3",
    "non-trip-segment-19",
    "169ff833-31fa-4ccf-b42e-25b19fd13cef",
    "169ff833-31fa-4ccf-b42e-25b19fd13cef,98262cdf-665c-404b-96cc-3bb060785a17",
    "98262cdf-665c-404b-96cc-3bb060785a17",
    "non-trip-segment-20",
    "22f94201-2cbc-40f5-89c4-09c4f18b7a71",
    "non-trip-segment-21",
    "f5664c34-4cd5-4bdd-a79c-4601651863ba",
    "b4102b22-6d77-425e-a7ad-0067a5499cda,f5664c34-4cd5-4bdd-a79c-4601651863ba",
    "b4102b22-6d77-425e-a7ad-0067a5499cda",
    "non-trip-segment-22",
    "d882a6f8-92aa-448e-b895-18e02567daea",
    "8d2ae8f2-baed-4335-bd50-871a8f33d494,d882a6f8-92aa-448e-b895-18e02567daea",
    "d882a6f8-92aa-448e-b895-18e02567daea",
    "non-trip-segment-23",
    "0381a573-98ea-41ae-9504-552903cc52f9,b406e602-aa99-40b3-b726-d6050a5e9cf1",
    "0381a573-98ea-41ae-9504-552903cc52f9",
  ]);
});
