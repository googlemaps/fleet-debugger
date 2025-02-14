# Fleet Debugger Tool

A visualization and debugging tool for Google Maps Platform's Mobility Solutions, supporting [Scheduled tasks](https://developers.google.com/maps/documentation/mobility/fleet-engine/essentials/tasks-intro) and [On-demand trips](https://developers.google.com/maps/documentation/mobility/fleet-engine/essentials/trip-intro).

![Screenshot](docs/screenshots/vehiclereplay.gif)

## Using the Demo Site(s)

The fastest way to get started is using our GitHub hosted site \
https://googlemaps.github.io/fleet-debugger/demos/multiple-trips

We also have demo data for:
- [GPS accuracy issues](https://googlemaps.github.io/fleet-debugger/demos/jump/)
- [Scheduled task](https://googlemaps.github.io/fleet-debugger/demos/lmfs/)

### Loading Your Data

1. Export your Fleet Engine logs from Cloud Logging using this filter (customize as needed): \
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
3. Import the JSON/ZIP file to Fleet Debugger

> **Note**: All data processing happens client-side. Your logs remain in your browser's Local Storage and are not uploaded to Google/GitHub.

### Key Features

- Filter & inspect log messages with customizable table views
- View planned navigation routes with traffic conditions as experienced by drivers
- Replay vehicle movement (real time or time lapse)
- See requested vs. actual pickup and dropoff points
- View status changes (vehicle, trip, navigation)
- Analyze GPS data (location, accuracy, heading)
- Visualize multiple trips for one vehicle
- View [GPS accuracy](docs/GPSAccuracy.md), [speed](docs/Speed.md), and [heading](docs/Heading.md)
- Analyze [dwell times](docs/DwellTimes.md)

> **Note**: Planned navigation routes and Pickup/DropOff points requires enablement of [Restricted Use Logs](https://developers.google.com/maps/documentation/mobility/operations/cloud-logging/setup#enable_restricted_use_logs)

### Restoring Demo Data
To restore the original demo data after overwriting it:
1. Long press the "Dataset 1" button
2. When prompted, do NOT upload a file
3. Refresh the page

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

## Disclaimer

This is not an officially supported Google product.

## Additional Resources

- [Reporting Issues](docs/reporting-issues.md)
