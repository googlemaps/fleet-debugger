#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query prints a daily summary of the number of distinct active tasks
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
    COUNT(DISTINCT labels.task_id) AS active_tasks
  FROM
    \`${argv.dataset}.fleetengine_googleapis_com_update_task\`
  WHERE
    DATE(timestamp) >= DATE_ADD(CURRENT_DATE(), INTERVAL -${argv.lastNDays} DAY)
  GROUP BY
    DATE(timestamp))
ORDER BY
  date DESC
`;
query(sql);
