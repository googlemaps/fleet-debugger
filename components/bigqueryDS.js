/*
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { Datasource } = require("./datasource.js");
const _ = require("lodash");
const { BigQuery } = require("@google-cloud/bigquery");

function sanitizeTimestamp(str) {
  // new Date("2022-04-14 09:24:34") generates  'Invalid Date' on safari.  Node seems to be happy ... so fix it up
  const date = new Date(str);
  return date.toISOString();
}

function getJsonPayloadField(entry) {
  const logName = entry.logName;
  if (logName.match("update_delivery_vehicle")) {
    return "jsonpayload_v1_updatedeliveryvehiclelog";
  }
  if (logName.match("create_delivery_vehicle")) {
    return "jsonpayload_v1_createdeliveryvehiclelog";
  }
  if (logName.match("create_task")) {
    return "jsonpayload_v1_createtasklog";
  }
  if (logName.match("update_task")) {
    return "jsonpayload_v1_updatetasklog";
  }
  if (logName.match("update_vehicle")) {
    return "jsonpayload_v1_updatevehiclelog";
  }
  if (logName.match("create_vehicle")) {
    return "jsonpayload_v1_createvehiclelog";
  }
  if (logName.match("create_trip")) {
    return "jsonpayload_v1_createtriplog";
  }
  if (logName.match("update_trip")) {
    return "jsonpayload_v1_updatetriplog";
  }
}

function normalize(entry) {
  const jsonPayloadField = getJsonPayloadField(entry);
  const jsonpayload = entry[jsonPayloadField];
  jsonpayload["@type"] = jsonpayload._type;
  delete jsonpayload._type;

  const normalizedEntry = {
    insertId: entry.insertId,
    logName: entry.logName,
    receiveTimestamp: sanitizeTimestamp(entry.receiveTimestamp.value),
    timestamp: sanitizeTimestamp(entry.timestamp.value),
    jsonpayload: jsonpayload,
    labels: entry.labels,
    resource: entry.resource,
  };
  return normalizedEntry;
}

class Bigquery extends Datasource {
  constructor(argv) {
    super(argv);
    this.dataset = argv.bigquery;
    this.bigquery = new BigQuery();
    this.datasetPrefix = "fleetengine_googleapis_com_"; // TODO: allow passin via argv
    this.tablePrefix = this.dataset + "." + this.datasetPrefix;
    this.datasetLocation = argv.datasetLocation;
    this.startTime = new Date(argv.startTime).toISOString();
    this.endTime = new Date(argv.endTime).toISOString();
    this.timeClause = "timestamp < @endTime and timeStamp > @startTime";
  }

  async bq(query, params) {
    const options = { query, params, location: this.datasetLocation };
    try {
      const [rows] = await this.bigquery.query(options);
      return rows;
    } catch (err) {
      if (err && err.message.match("Not found: Table")) {
        console.error(
          "Assuming missing table is due to odrd or lmfs not being enabled:",
          err.message
        );
        return [];
      }
      throw err;
    }
  }
  /*
   * Extract trip_ids from vehicle logs, and query again to
   * get the createTrip/update trip calls that may not be labeled
   * with a vehicle
   */
  async fetchTripLogsForVehicle(vehicle_id, vehicleLogs) {
    console.log("Loading trip logs for vehicle id", vehicle_id);
    const trip_ids = _(vehicleLogs)
      .map((x) => _.split(_.get(x, "labels.trip_id"), ","))
      .flatten()
      .uniq()
      .compact()
      .value();
    const tripPromises = trip_ids.map(async (trip_id) => {
      // TODO use a subquery and let BQ do all the work
      const createQuery = `
SELECT
  *
FROM
  \`${this.tablePrefix}create_trip\`
WHERE
  labels.trip_id=@trip_id
  AND ${this.timeClause}
ORDER BY
  timestamp DESC
LIMIT
  10`;
      const createLogs = await this.bq(createQuery, {
        trip_id: trip_id,
        startTime: this.startTime,
        endTime: this.endTime,
      });
      const updateQuery = `
SELECT
  *
FROM
  \`${this.tablePrefix}update_trip\`
WHERE
  labels.trip_id=@trip_id
  AND ${this.timeClause}
ORDER BY
  timestamp DESC
LIMIT
  10`;
      const updateLogs = await this.bq(updateQuery, {
        trip_id: trip_id,
        startTime: this.startTime,
        endTime: this.endTime,
      });
      return [createLogs, updateLogs];
    });

    const tripLogs = _(await Promise.all(tripPromises))
      .flatten()
      .flatten()
      .map(normalize)
      .value();

    console.log(`found ${tripLogs.length} ODRD trip logs`);
    return tripLogs;
  }

  /*
   * Fetch all updates to any task that was ever assigned to this vehicle.  Tasks
   * are enumarated by looking at stops in update vehicle and labels on update task.
   *
   * This should ensure logs that cover situations like a given task being
   * assigned to a vehicle ... but never being updated (or being updated and assigned
   * to a different vehicle).
   *
   * Note labels.delivery_vehicle_id is not necessarily set at creation
   * time (or even on all update requests).
   */
  async fetchTaskLogsForVehicle(delivery_vehicle_id) {
    console.log(
      "Loading tasks logs for deliveryVehicle id",
      delivery_vehicle_id
    );
    const params = {
      delivery_vehicle_id,
      startTime: this.startTime,
      endTime: this.endTime,
    };

    const taskIDQuery = `
WITH
  taskids AS(
  SELECT
    DISTINCT tasks.taskid AS taskid
  FROM (
    SELECT
      labels.delivery_vehicle_id,
      timestamp,
      segments
    FROM
    \`${this.tablePrefix}update_delivery_vehicle\`,
      UNNEST( jsonpayload_v1_updatedeliveryvehiclelog.request.deliveryvehicle.remainingvehiclejourneysegments ) segments ),
    UNNEST(segments.stop.tasks) AS tasks
  WHERE
    delivery_vehicle_id = @delivery_vehicle_id AND ${this.timeClause}
  UNION DISTINCT
  SELECT
    labels.task_id AS taskid
  FROM
    \`${this.tablePrefix}update_task\`
  WHERE
    labels.delivery_vehicle_id = @delivery_vehicle_id AND ${this.timeClause})
    `;

    const createQuery = `
${taskIDQuery}
SELECT
  *
FROM
  \`${this.tablePrefix}create_task\`
WHERE
  ${this.timeClause} and labels.task_id IN (SELECT * from taskids) 
LIMIT 5000
`;

    const createData = await this.bq(createQuery, params);
    const updateQuery = `
${taskIDQuery}
SELECT
  *
FROM
  \`${this.tablePrefix}update_task\`
WHERE
  ${this.timeClause} and labels.task_id IN (SELECT * from taskids) 
LIMIT 5000
`;

    const updateData = await this.bq(updateQuery, params);

    const data = createData.concat(updateData);
    console.log(`found ${data.length} LMFS task logs`);
    return data.map(normalize);
  }

  async fetchVehicleLogs(vehicle_id, trip_id) {
    // TODO: handle case where table doesn't exist (ie in a lmfs project)
    let whereClause;
    const params = {
      startTime: this.startTime,
      endTime: this.endTime,
    };
    if (vehicle_id) {
      params.vehicle_id = vehicle_id;
      whereClause = "labels.vehicle_id=@vehicle_id";
      console.log(`Fetching logs for vehicle ${vehicle_id}`);
    } else {
      params.trip_id = trip_id;
      whereClause = `labels.trip_id = @trip_id"`;
      console.log(`Fetching logs for trip ${trip_id}`);
    }

    const createQuery = `
SELECT
  *
FROM
  \`${this.tablePrefix}create_vehicle\`
WHERE
  ${whereClause}
  AND ${this.timeClause}
ORDER BY
  timestamp DESC
LIMIT
  5000`;
    const createData = await this.bq(createQuery, params);

    const updateQuery = `
SELECT
  *
FROM
  \`${this.tablePrefix}update_vehicle\`
WHERE
  ${whereClause}
  AND ${this.timeClause}
ORDER BY
  timestamp DESC
LIMIT
  5000`;
    const updateData = await this.bq(updateQuery, params);
    const data = createData.concat(updateData);
    console.log(`found ${data.length} ODRD vehicle logs`);
    return data.map(normalize);
  }

  async fetchDeliveryVehicleLogs(delivery_vehicle_id) {
    console.log("Loading vehicle logs for vehicle id", delivery_vehicle_id);
    const params = {
      delivery_vehicle_id,
      startTime: this.startTime,
      endTime: this.endTime,
    };
    const createQuery = `
SELECT
  *
FROM
  \`${this.tablePrefix}create_delivery_vehicle\`
WHERE
  labels.delivery_vehicle_id=@delivery_vehicle_id
  AND ${this.timeClause}
ORDER BY
  timestamp DESC
LIMIT
  5000
`;

    const createData = await this.bq(createQuery, params);

    const updateQuery = `
SELECT
  *
FROM
  \`${this.tablePrefix}update_delivery_vehicle\`
WHERE
  labels.delivery_vehicle_id=@delivery_vehicle_id
  AND ${this.timeClause}
ORDER BY
  timestamp DESC
LIMIT
  5000
`;
    const updateData = await this.bq(updateQuery, params);
    const data = createData.concat(updateData);
    console.log(`found ${data.length} LMFS vehicle logs`);
    return data.map(normalize);
  }
}

exports.Bigquery = Bigquery;
