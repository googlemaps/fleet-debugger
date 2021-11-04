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
} from "./Map";
import Dataframe from "./Dataframe";
import TimeSlider from "./TimeSlider";
import LogTable from "./LogTable";
import ToggleBar from "./ToggleBar";
import _ from "lodash";

class App extends React.Component {
  constructor(props) {
    super(props);
    this.logData = props.logData;
    this.state = {
      timeRange: {
        minDate: 0,
        maxDate: new Date("1/1/2050").getTime(),
      },
      featuredObject: { msg: "Click a table row to select object" },
      extraColumns: [],
      toggleOptions: {
        showGPSBubbles: false,
        showHeading: false,
        showSpeed: false,
        showTraffic: false,
      },
    };
    // Realtime updates are too heavy.  There must be a better/ react way
    this.onSliderChangeDebounced = _.debounce(
      (timeRange) => this.onSliderChange(timeRange),
      25
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
   * Updates react state associated with the slider and calls into
   * the non-react map code to do the same.
   */
  onSliderChange(timeRange) {
    this.setState({
      timeRange: {
        minDate: timeRange.minDate,
        maxDate: timeRange.maxDate,
      },
    });

    // Handle Map component separately from standard state update
    onSliderChangeMap(timeRange.minDate, timeRange.maxDate);
  }

  /*
   * Callback to updated selected log row
   */
  onSelectionChange(selectedRow) {
    addMarkersToMapForData(selectedRow);
    this.setState({ featuredObject: selectedRow });
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
        />
        <div style={{ width: "100%", marginTop: "20px" }}>
          <div style={{ width: "65%", overflowX: "scroll", float: "left" }}>
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
          <div style={{ marginLeft: "65%" }}>
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
