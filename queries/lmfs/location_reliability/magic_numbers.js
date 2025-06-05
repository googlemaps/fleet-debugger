#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query filters and the aggregates all of the location accuracy 
measurements coming from the device that are even integers.  Given the
math involved to compute an accuracy a result that is exactly an integer
is unlikely.  These numbers probably represent hardcoded values coming from the
directly from the GPS chipset.   One phone owned by the author appears to have
artifically capped the worst accuracy value it reports as exactly 15 meters (which
would normally be a quite acceptable value).
`;
const argv = require("../../util/args.js").processArgs(desc, {});
const sql = `
SELECT
  COUNT(*) magicNumberCnt,
  locAccuracy,
FROM (
  SELECT
    jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.rawlocationaccuracy AS locAccuracy,
    labels.delivery_vehicle_id,
  FROM
    \`${argv.dataset}.fleetengine_googleapis_com_update_delivery_vehicle\`
  WHERE
    CAST(jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.lastlocation.rawlocationaccuracy AS string) NOT LIKE "%.%"
  ORDER BY
    timestamp DESC
  LIMIT
    100000 )
GROUP BY
  locAccuracy
ORDER BY
  magicNumberCnt DESC
`;
query(sql);
