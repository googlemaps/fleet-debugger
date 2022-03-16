/*
 * App.js
 *
 * Basic react app container.  Handles state for the app and
 * propagation for state changes into the non-react map
 */
import React from "react";
import {
  onSliderChangeMap,
  addMarkersToMapForData,
  updateMapToggles,
  registerHandlers,
  mapLoadPromise,
} from "./Map";
import Dataframe from "./Dataframe";
import TimeSlider from "./TimeSlider";
import LogTable from "./LogTable";
import ToggleBar from "./ToggleBar";
import _ from "lodash";
import { getQueryStringValue, setQueryStringValue } from "./queryString";

/**
 * returns the default value for the button from the url
 */
function getToggleDefault(urlKey, defaultVal) {
  const urlVal = getQueryStringValue(urlKey);
  if (urlVal === "true") {
    defaultVal = true;
  }
  return defaultVal;
}

class App extends React.Component {
  constructor(props) {
    super(props);
    const nowDate = new Date();
    let urlMinTime = getQueryStringValue("minTime");
    let urlMaxTime = getQueryStringValue("maxTime");
    this.initialMinTime = urlMinTime ? parseInt(urlMinTime) : 0;
    // default max time to 1 year in the future
    this.initialMaxTime = urlMaxTime
      ? parseInt(urlMaxTime)
      : nowDate.setFullYear(nowDate.getFullYear() + 1);

    this.logData = props.logData;
    this.state = {
      timeRange: {
        minTime: this.initialMinTime,
        maxTime: this.initialMaxTime,
      },
      featuredObject: { msg: "Click a table row to select object" },
      extraColumns: [],
      toggleOptions: {
        showGPSBubbles: getToggleDefault("showGPSBubbles", false),
        showHeading: getToggleDefault("showHeading", false),
        showSpeed: getToggleDefault("showSpeed", false),
        showTraffic: getToggleDefault("showTraffic", false),
        showTripStatus: getToggleDefault("showTripStatus", false),
        showDwellLocations: getToggleDefault("showDwellLocations", false),
        showNavStatus: getToggleDefault("showNavStatus", false),
        showETADeltas: getToggleDefault("showETADeltas", false),
        showHighVelocityJumps: getToggleDefault("showHighVelocityJumps", false),
        showMissingUpdates: getToggleDefault("showMissingUpdates", false),
        showLiveJS: getToggleDefault("showLiveJS", false),
        showClientServerTimeDeltas: getToggleDefault(
          "showClientServerTimeDeltas",
          false
        ),
      },
    };
    // Realtime updates are too heavy.  There must be a better/ react way
    this.onSliderChangeDebounced = _.debounce(
      (timeRange) => this.onSliderChange(timeRange),
      25
    );

    // Allow map code to set which object is featured, and
    // adjust the timerange filtering
    registerHandlers(
      (fo) => this.setFeaturedObject(fo),
      (minTime, maxTime) => this.setTimeRange(minTime, maxTime)
    );
    // TODO: refactor so that visualizations are registered
    // rather than enumerated here?
    this.toggles = _.filter(
      [
        {
          id: "showGPSBubbles",
          name: "GPS Accuracy",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/GPSAccuracy.md",
          columns: [
            "lastLocation.rawLocationAccuracy",
            "lastLocation.locSensor",
          ],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showHeading",
          name: "Heading",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Heading.md",
          columns: ["lastLocation.heading", "lastLocation.bearingAccuracy"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showSpeed",
          name: "Speed",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Speed.md",
          columns: ["lastLocation.speed"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showTripStatus",
          name: "Trip Status",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/TripStatus.md",
          columns: [],
          solutionTypes: ["ODRD"],
        },
        {
          id: "showNavStatus",
          name: "Navigation Status",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/NavStatus.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showDwellLocations",
          name: "Dwell Locations",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/DwellTimes.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showHighVelocityJumps",
          name: "Jumps (unrealistic velocity)",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/VelocityJumps.md",
          columns: ["lastLocation.speed"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showMissingUpdates",
          name: "Jumps (Temporal)",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/MissingUpdates.md",
          columns: ["jsonPayload.temporal_gap"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showClientServerTimeDeltas",
          name: "Client/Server Time Deltas",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
          columns: [
            "jsonPayload.response.lastLocation.rawLocationTime",
            "jsonPayload.response.lastLocation.serverTime",
          ],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showETADeltas",
          name: "ETA Deltas",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/docs/EtaDeltas.md",
          columns: ["jsonPayload.request.vehicle.etaToFirstWaypoint"],
          solutionTypes: ["ODRD"],
        },
        {
          id: "showTraffic",
          name: "Traffic",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showLiveJS",
          name: "Start Live Journey Sharing for newest trip",
          docLink:
            "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
      ],
      (toggle) => {
        return toggle.solutionTypes.indexOf(this.logData.solutionType) !== -1;
      }
    );
  }

  /*
   * Update react state from data in the url.  This could/should be
   * cleaned up.  The pure react state is actually set properly in the
   * constructor ... all this does is update the map and associated
   * data (once it's loaded).  Given this split it's definitely possible
   * that this just overwrites settings a quickfingered user already
   * changed.
   */
  componentDidMount() {
    mapLoadPromise.then(() => {
      this.setTimeRange(this.initialMinTime, this.initialMaxTime);
      _.map(this.toggles, (toggle) => {
        const urlVal = getQueryStringValue(toggle.id);
        if (urlVal === "true") {
          this.updateToggleState(true, toggle.id, toggle.columns);
        }
      });
    });
  }

  updateToggleState(newValue, toggleName, jsonPaths) {
    this.setState((prevState) => {
      prevState.toggleOptions[toggleName] = newValue;
      updateMapToggles(toggleName, newValue);
      setQueryStringValue(toggleName, newValue);

      const extraColumns = _.clone(prevState.extraColumns);
      _.forEach(jsonPaths, (path) => {
        if (newValue) {
          extraColumns.push(path);
        } else {
          _.pull(extraColumns, path);
        }
      });
      prevState.extraColumns = _.uniq(extraColumns);

      return prevState;
    });
  }

  /*
   * Updates react state associated with the slider and calls into
   * the non-react map code to do the same.
   */
  onSliderChange(timeRange) {
    this.setTimeRange(timeRange.minTime, timeRange.maxTime);
  }

  /*
   * Callback to updated selected log row
   */
  onSelectionChange(selectedRow) {
    addMarkersToMapForData(selectedRow);
    this.setFeaturedObject(selectedRow);
  }

  /*
   * Set the featured object
   */
  setFeaturedObject(featuredObject) {
    this.setState({ featuredObject: featuredObject });
  }

  /*
   * exposes editing of the timeRange state
   */
  setTimeRange(minTime, maxTime) {
    setQueryStringValue("minTime", minTime);
    setQueryStringValue("maxTime", maxTime);
    this.setState({
      timeRange: {
        minTime: minTime,
        maxTime: maxTime,
      },
    });

    // Handle Map component separately from standard state update
    onSliderChangeMap(minTime, maxTime);
  }

  /*
   * Callback to handle clicks on properties in the json viewer.
   * Adds/removes row from the log viewer based on which property
   * in the json object was clicked on
   */
  onDataframePropClick(select) {
    this.setState((prevState) => {
      const jsonPath = _.join(select.namespace, ".") + "." + select.name;
      let newColumns;
      if (_.find(prevState.extraColumns, (x) => x === jsonPath)) {
        newColumns = _.without(prevState.extraColumns, jsonPath);
      } else {
        newColumns = [...prevState.extraColumns, jsonPath];
      }
      return {
        extraColumns: newColumns,
      };
    });
  }

  toggleClickHandler(id) {
    const toggle = _.find(this.toggles, { id });
    const newValue = !this.state.toggleOptions[id];
    this.updateToggleState(newValue, id, toggle.columns);
  }

  render() {
    return (
      <div>
        <TimeSlider
          logData={this.logData}
          curMin={this.state.timeRange.minTime}
          curMax={this.state.timeRange.maxTime}
          onSliderChange={this.onSliderChangeDebounced}
        />
        <ToggleBar
          toggles={this.toggles}
          toggleState={this.state.toggleOptions}
          clickHandler={(id) => this.toggleClickHandler(id)}
        />
        <div style={{ width: "100%", marginTop: "20px" }}>
          <div
            style={{
              width: "65%",
              overflowX: "scroll",
              overFlowY: "scroll",
              height: "100%",
              float: "left",
            }}
          >
            <LogTable
              logData={this.logData}
              style={{ width: "100%" }}
              timeRange={this.state.timeRange}
              extraColumns={this.state.extraColumns}
              onSelectionChange={(featuredObject) =>
                this.onSelectionChange(featuredObject)
              }
            />
          </div>
          <div
            style={{
              marginLeft: "65%",
              overFlowX: "scroll",
              overFlowY: "scroll",
              height: "100%",
            }}
          >
            <Dataframe
              featuredObject={this.state.featuredObject}
              onClick={(select) => this.onDataframePropClick(select)}
            />
          </div>
        </div>
      </div>
    );
  }
}

export { App as default };
