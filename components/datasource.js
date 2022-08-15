/*
 * Copyvaright 2022 Google LLC
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

class Datasource {
  constructor(argv) {
    this.argv = argv;
  }

  async fetchVehicleAndTripLogs(vehicle, trip) {
    throw new Error("Not Implemented", vehicle, trip);
  }

  async fetchDeliveryVehicleLogs(deliveryVehicle, vehicleLogs) {
    throw new Error("Not Implemented", deliveryVehicle, vehicleLogs);
  }

  async fetchTaskLogsForVehicle(vehicle_id, vehicleLogs) {
    throw new Error("Not Implemented", vehicle_id, vehicleLogs);
  }
}

exports.Datasource = Datasource;
