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
} from "./Map";
import Dataframe from "./Dataframe";
import TimeSlider from "./TimeSlider";
import LogTable from "./LogTable";
import ToggleBar from "./ToggleBar";
import _ from "lodash";

class App extends React.Component {
  constructor(props) {
    super(props);
    const nowDate = new Date();
    this.logData = props.logData;
    this.state = {
      timeRange: {
        minTime: 0,
        // default max time to 1 year in the future
        maxTime: nowDate.setFullYear(nowDate.getFullYear() + 1),
      },
      featuredObject: { msg: "Click a table row to select object" },
      extraColumns: [],
      toggleOptions: {
        showGPSBubbles: false,
        showHeading: false,
        showSpeed: false,
        showTraffic: false,
        showDwellLocations: false,
        showHighVelocityJumps: false,
        showMissingUpdates: false,
        showLiveJS: false,
        showClientServerTimeDeltas: false,
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
  }

  updateColumns(toggleName, jsonPaths) {
    this.setState((prevState) => {
      const newValue = !prevState.toggleOptions[toggleName];
      prevState.toggleOptions[toggleName] = newValue;
      updateMapToggles(toggleName, newValue);

      const extraColumns = _.clone(prevState.extraColumns);
      _.forEach(jsonPaths, (path) => {
        if (newValue) {
          extraColumns.push(path);
        } else {
          _.pull(extraColumns, path);
        }
      });
      prevState.extraColumns = extraColumns;

      return prevState;
    });
  }

  /*
   * Updates react state assocated with the gps bubbles, including
   * adding/removing appropriate rows in the log viewer
   */
  onClickGPSBubbles() {
    this.updateColumns("showGPSBubbles", [
      "jsonPayload.request.vehicle.lastLocation.rawLocationAccuracy",
      "jsonPayload.request.vehicle.lastLocation.locSensor",
    ]);
  }

  /*
   * Updates react state assocated with the heading arrows, including
   * adding/removing appropriate rows in the log viewer
   */
  onClickHeading() {
    this.updateColumns("showHeading", [
      "jsonPayload.request.vehicle.lastLocation.heading",
      "jsonPayload.request.vehicle.lastLocation.bearingAccuracy",
    ]);
  }

  /*
   * Updates react state assocated with the speed bubbles, including
   * adding/removing appropriate rows in the log viewer
   */
  onClickSpeed() {
    this.updateColumns("showSpeed", [
      "jsonPayload.request.vehicle.lastLocation.speed",
    ]);
  }

  /*
   * Updates react state assocated with the traffic layer
   */
  onClickTraffic() {
    this.updateColumns("showTraffic", []);
  }

  /*
   * Updates react state assocated with the dwellLocations layer
   */
  onClickDwellLocations() {
    this.updateColumns("showDwellLocations", []);
  }

  /*
   * Updates react state assocated with the high velocity jumps layer
   */
  onClickHighVelocityJumps() {
    this.updateColumns("showHighVelocityJumps", [
      "jsonPayload.request.vehicle.lastLocation.speed",
    ]);
  }

  /*
   * Updates react state assocated with the missing updates layer
   */
  onClickMissingUpdates() {
    this.updateColumns("showMissingUpdates", ["jsonPayload.temporal_gap"]);
  }

  /*
   * Updates react state assocated with the missing updates layer
   */
  onClickClientServerTimeDeltas() {
    this.updateColumns("showClientServerTimeDeltas", [
      "jsonPayload.response.lastLocation.rawLocationTime",
      "jsonPayload.response.lastLocation.serverTime",
    ]);
  }

  /*
   * Updates react state assocated with the live journey sharing
   */
  onClickLiveJS() {
    this.updateColumns("showLiveJS", []);
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
          showGPSBubbles={this.state.toggleOptions.showGPSBubbles}
          onClickGPSBubbles={() => this.onClickGPSBubbles()}
          showSpeed={this.state.toggleOptions.showSpeed}
          onClickSpeed={() => this.onClickSpeed()}
          showHeading={this.state.toggleOptions.showHeading}
          onClickHeading={() => this.onClickHeading()}
          showTraffic={this.state.toggleOptions.showTraffic}
          onClickTraffic={() => this.onClickTraffic()}
          showDwellLocations={this.state.toggleOptions.showDwellLocations}
          onClickDwellLocations={() => this.onClickDwellLocations()}
          showHighVelocityJumps={this.state.toggleOptions.showHighVelocityJumps}
          onClickHighVelocityJumps={() => this.onClickHighVelocityJumps()}
          showMissingUpdates={this.state.toggleOptions.showMissingUpdates}
          onClickMissingUpdates={() => this.onClickMissingUpdates()}
          showLiveJS={this.state.toggleOptions.showLiveJS}
          onClickLiveJS={() => this.onClickLiveJS()}
          showClientServerTimeDeltas={
            this.state.toggleOptions.showClientServerTimeDeltas
          }
          onClickClientServerTimeDeltas={() =>
            this.onClickClientServerTimeDeltas()
          }
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
