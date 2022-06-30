#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query prints out per vehicle the fraction of location updates where the
navigation status was listed as NAVIGATION_STATUS_OFF_ROUTE.  Vehicles
with a high fraction of off route updates can indicate a number of problems:
  * poor GPS reception (due to bad phone hardware or urban canyons)
  * poor route compliance (ie a cyclist given a 4 wheeler route)
  * Complicated complex compounds/ parking lots where navigation is
    not particularly helpful
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
  *,
  offRouteUpdates/totalNavStatusUpdates AS fractionOffRoute
FROM (
  SELECT
    labels.delivery_vehicle_id AS vehicle_id,
    COUNT(*) AS totalNavStatusUpdates,
    COUNTIF(jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.navigationstatus = "NAVIGATION_STATUS_OFF_ROUTE") AS offRouteUpdates,
  FROM
    \`${argv.dataset}.fleetengine_googleapis_com_update_delivery_vehicle\`
  WHERE
    DATE(timestamp) = "${argv.date}"
    AND jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.navigationstatus IS NOT NULL
  GROUP BY
    labels.delivery_vehicle_id )
ORDER BY
  fractionOffRoute DESC
`;
query(sql);
