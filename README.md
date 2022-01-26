# Fleet Debugger Tool

A debugging tool for use with the stateful Last Mile Fleet Solutions and [On Demand Rides and
Deliveries](https://developers.google.com/maps/documentation/transportation-logistics/on-demand-rides-deliveries-solution) solutions.

![Screenshot](docs/screenshots/fleetdebugger.png)

## Disclaimer

This is not an officially supported Google product

## Demos


* [Demo with GPS accurracy issues](https://googlemaps.github.io/fleet-debugger/demos/jump/)
* [Demo with multiple trips](https://googlemaps.github.io/fleet-debugger/demos/multiple-trips/)
* [Demo with LMFS tasks](https://googlemaps.github.io/fleet-debugger/demos/lmfs/)


## Getting Started

### Dependencies

Download & install node
Download & install gcloud

### Setup authentication

```
gcloud config set project <your project id>
gcloud auth login
gcloud auth application-default login
```

### Populate ./node_modules directory

```
npm install
```

## Examples

View historical data from my-vehicle-id via journey sharing SDK

```
# Generate data files
dune-buggy.js historical --apikey <your api key> --vehicle=my-vehicle-id
# start UI (should open up browser to localhost:3000
npm start
```

Generate sharable artifact

```
# Generate data files
dune-buggy.js historical --apikey <your api key> --vehicle=my-vehicle-id
# build sharable, static artifact.  Any webserver should be able to host this.
npm run build
tar -czf support-dump.tgz build
```

## Key Features

Filter & Inspect log messages

Customize which fields are shown in table view

View important status changes: vehicle status, trip status, navigation status

View raw GPS information, including location, accuracy & heading

### Comprehensive, Pre-built Visualizations
* Visualize multiple trips for one vehicle
* [Replay Vehicle Movement](docs/ReplaceVehicleMovement.md)
* [GPS Accuracy](docs/GPSAccuracy.md)
* [Vehicle Speed](docs/Speed.md)
* [Vehicle Heading](docs/Heading.md)
* [Dwell Times](docs/DwellTimes.md)


### Extensibility
   * Easily add aditional related data from cloud logging
