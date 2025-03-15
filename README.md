# Fleet Debugger Tool

A visualization and debugging tool for Google Maps Platform's Mobility Solutions, supporting [Scheduled tasks](https://developers.google.com/maps/documentation/mobility/fleet-engine/essentials/tasks-intro) and [On-demand trips](https://developers.google.com/maps/documentation/mobility/fleet-engine/essentials/trip-intro).

![Screenshot](docs/screenshots/vehiclereplay.gif)

## Using the Demo Site(s)

The fastest way to get started is using our GitHub hosted site: \
https://googlemaps.github.io/fleet-debugger/demos/multiple-trips

We also have demo data for:
- [Scheduled task](https://googlemaps.github.io/fleet-debugger/demos/lmfs/)

### Loading Your Data

Click on any empy Dataset buttons `Load Dataset` to get the `Fleet Engine Logs Loading` UI.

![Fleet Engine Logs Loading](docs/screenshots/Fleet_Engine_Logs_Loading.png)

#### Direct Cloud Logging Connection (Recommended)

1.  **Configure Parameters:**  Configure the Cloud Logging query parameters directly within UI.

2.  **Connect to Cloud Logging:**  The Fleet Debugger can connect directly to your Google Cloud project's Cloud Logging.  Click the `Sign in and Fetch Logs` button and follow the prompts to authenticate and grant access.  You'll need appropriate IAM permissions (`roles/logging.viewer` which is also granted via `roles/viewer`) for the Fleet Debugger to read logs.

#### Log Files in JSON Format

1. Export your Fleet Engine logs from Cloud Logging using one of the following filters (customize as needed):

```sql
-- On-demand trips
resource.type="fleetengine.googleapis.com/Fleet"
AND (labels.vehicle_id="YOUR_VEHICLE_ID" OR
     labels.trip_id=~"(TRIP_ID_1|TRIP_ID_2)")
AND timestamp >= "START_TIME" -- ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
AND timestamp <= "END_TIME" -- ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
AND (
    logName:"logs/fleetengine.googleapis.com%2Fcreate_vehicle" OR
    logName:"logs/fleetengine.googleapis.com%2Fupdate_vehicle" OR
    logName:"logs/fleetengine.googleapis.com%2Fcreate_trip" OR
    logName:"logs/fleetengine.googleapis.com%2Fupdate_trip"
)
```

```sql
-- Scheduled tasks
resource.type="fleetengine.googleapis.com/DeliveryFleet"
AND (labels.delivery_vehicle_id="YOUR_VEHICLE_ID" OR
     labels.task_id=~"(TASK_ID_1|TASK_ID_2)")
AND timestamp >= "START_TIME" -- ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
AND timestamp <= "END_TIME" -- ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
AND (
    logName:"logs/fleetengine.googleapis.com%2Fcreate_delivery_vehicle" OR
    logName:"logs/fleetengine.googleapis.com%2Fupdate_delivery_vehicle" OR
    logName:"logs/fleetengine.googleapis.com%2Fcreate_task" OR
    logName:"logs/fleetengine.googleapis.com%2Fupdate_task"
)
```

2. Download the logs in JSON format and optionally zip them
3. Import the JSON/ZIP file to Fleet Debugger, using the `Load JSON or ZIP file instead` button.

> **Note**: All data processing happens client-side. Your logs remain in your browser's Local Storage and are not uploaded to Google/GitHub.

### Key Features

-   **Filter & inspect log messages:**  Use customizable table views to easily find and analyze specific log entries.
-   **View planned navigation routes:**  See the routes with traffic conditions as experienced by drivers (requires [Restricted Use Logs](#restricted-use-logs)).
-   **Replay vehicle movement:**  Observe vehicle movement in real time or at an accelerated time-lapse.
-   **See requested vs. actual pickup and dropoff points:** (requires [Restricted Use Logs](#restricted-use-logs)).
-   **View status changes:**  Track changes in vehicle, trip, and navigation status.
-   **Analyze GPS data:**  Examine location, accuracy, and heading information.
-   **Visualize multiple trips:**  View all trips for a single vehicle.
-   **Analyze GPS accuracy, speed, and heading:**  Detailed analysis tools for these metrics ([GPS accuracy](docs/GPSAccuracy.md), [speed](docs/Speed.md), [heading](docs/Heading.md)).
-   **Analyze dwell times:**  Measure time spent at specific locations ([dwell times](docs/DwellTimes.md)).
-   **Map and Timeslider Interaction:** Click directly on the map or the timeslider to select the nearest log event.
-   **Tracking (Chevron):**  Use the tracking button to keep the map centered on the current event during replay.
-   **Exporting Logs:** Export loaded dataset to a local file for easy collaboration.

### Restricted Use Logs

Planned navigation routes and requested Pickup/Dropoff points require enablement of [Restricted Use Logs](https://developers.google.com/maps/documentation/mobility/operations/cloud-logging/setup#enable_restricted_use_logs).

### Managing Datasets

Each dataset (loaded from a file or Cloud Logging) has a dropdown menu:

-   **Save (Export):**  Save the current dataset as a JSON file.
-   **Delete:** Remove the dataset from the Fleet Debugger.  This clears the data from your browser's local storage.

### Restoring Demo Data

To reload the original demo data:
1.  Select "Delete" from `Dataset 1` dropdown menu.
2.  Refresh the page. The demo data will be automatically reloaded into Dataset 1.

## Running Your Own Server

### Development Setup

1. Install dependencies:
   - [Node.js](https://nodejs.org/en/download)

2. Install node modules:
```bash
npm install
```

### Start development server

```bash
npm start
```

### Building and Deploying

```bash
# Generate static build
npm run build

# Deploy to firebase
npm install -g firebase-tools
firebase deploy --only hosting
```

## Privacy Policy

This project is 100% client-side and does not collect or store any user data on servers.  Please see our [Privacy Policy](docs/PRIVACY.md) for full details.

## Disclaimer

This is not an officially supported Google product.

## Additional Resources

- [Reporting Issues](docs/reporting-issues.md)
