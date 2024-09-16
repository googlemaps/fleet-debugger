#!/usr/bin/env node
const { query } = require("../../util/query.js");
const desc = `
This query computes the breakdown of task outcomes specified
in update_task calls over the last 30 days.  The query doesn't
attempt to filter out duplicates. 
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
    COUNTIF(jsonpayload_v1_updatetasklog.response.taskoutcome = "TASK_OUTCOME_LOG_SUCCEEDED") AS success_outcomes,
    COUNTIF(jsonpayload_v1_updatetasklog.response.taskoutcome = "TASK_OUTCOME_LOG_FAILED") AS fail_outcomes
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
