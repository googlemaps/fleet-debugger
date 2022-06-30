#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query prints a daily summary of the number of created vehicles
`;
const argv = require("../../util/args.js").processArgs(desc, {
  lastNDays: {
    describe: "Use this value instead of the default",
    default: 30,
  },
});
const sql = `
SELECT
  *
FROM (
  SELECT
    DATE(timestamp) AS date,
    COUNT(DISTINCT labels.delivery_vehicle_id) AS created_vehicles
  FROM
    \`${argv.dataset}.fleetengine_googleapis_com_create_delivery_vehicle\`
  WHERE
    DATE(timestamp) >= DATE_ADD(CURRENT_DATE(), INTERVAL -${argv.lastNDays} DAY)
  GROUP BY
    DATE(timestamp))
ORDER BY
  date DESC
`;
query(sql);
