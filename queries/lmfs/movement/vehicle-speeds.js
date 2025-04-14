#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query returns the average and max reported speed (as per device GPS) for all
vehicles on the specified day.
`;
const argv = require("../../util/args.js").processArgs(desc, {
  date: {
    describe: "ISO date string to aggegrate distance traveled. ie 2022-06-03",
    required: true,
    // Default to today
    default: new Date().toISOString().slice(0, 10),
  },
});
const sql = `
SELECT
  labels.delivery_vehicle_id AS vehicle_id,
  AVG(jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.speed) AS avgSpeed,
  MAX(jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.speed) AS maxSpeed,
  count (*) AS num_updates
FROM
  \`${argv.dataset}.fleetengine_googleapis_com_update_delivery_vehicle\`
WHERE
  DATE(timestamp) = "${argv.date}"
  AND jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.speed IS NOT NULL
GROUP BY
  labels.delivery_vehicle_id
ORDER BY
  maxSpeed DESC
`;
query(sql);
