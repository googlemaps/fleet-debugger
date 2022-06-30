#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query returns the number of kilometers traveled by the specified
vehicle on the specified day.
`;
const argv = require("../../util/args.js").processArgs(desc, {
  date: {
    describe: "ISO date string to aggegrate distance traveled. ie 2022-06-03",
    required: true,
    // Default to today
    default: new Date().toISOString().slice(0, 10),
  },
  vehicle: {
    describe: "vehicle to inspect",
    required: true,
  },
});
const sql = `
SELECT
  labels.delivery_vehicle_id AS vehicle_id,
  ST_LENGTH(ST_makeLine(ARRAY_AGG(st_geogpoint(jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.rawlocation.longitude,
          jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.rawlocation.latitude)
      ORDER BY
        timestamp)))/1000 AS km_traveled,
  count (*) AS num_updates
FROM
  \`${argv.dataset}.fleetengine_googleapis_com_update_delivery_vehicle\`
WHERE
  DATE(timestamp) = "${argv.date}"
  AND jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryVehicle.lastLocation.rawLocation.longitude IS NOT NULL
  AND labels.delivery_vehicle_id = "${argv.vehicle}"
GROUP BY
  labels.delivery_vehicle_id
`;
query(sql);
