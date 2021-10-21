# Fleet Debugger Tool

A debugging tool for use with the stateful Last Mile Fleet Solutions and On Demaind Rides and
Deliveries solutions.

## Disclaimer

This is not an officially supported Google product

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

View current data from my-vehicle-id via journey sharing SDK

```
herbie.js live --apikey <your api key> --vehicle=my-vehicle-id
```

View historical data from my-vehicle-id
```
herbie.js historical --apikey <your api key> --vehicle=my-vehicle-id
```

## UI

![Screenshot](docs/screenshots/fleetdebugger.png)
