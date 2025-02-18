/*
 * src/App.js
 *
 * Basic react app container.  Handles state for the app and
 * propagation for state changes into the non-react map
 */
import React from "react";
import Map from "./Map";
import Dataframe from "./Dataframe";
import TimeSlider from "./TimeSlider";
import LogTable from "./LogTable";
import ToggleBar from "./ToggleBar";
import TripLogs from "./TripLogs";
import { uploadFile, getUploadedData, deleteUploadedData } from "./localStorage";
import _ from "lodash";
import { getQueryStringValue, setQueryStringValue } from "./queryString";
import "./global.css";
import { log } from "./Utils";

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
    this.centerOnLocation = null;
    const nowDate = new Date();
    let urlMinTime = getQueryStringValue("minTime");
    let urlMaxTime = getQueryStringValue("maxTime");
    this.initialMinTime = urlMinTime ? parseInt(urlMinTime) : 0;
    // default max time to 1 year in the future
    this.initialMaxTime = urlMaxTime ? parseInt(urlMaxTime) : nowDate.setFullYear(nowDate.getFullYear() + 1);

    this.focusOnRowFunction = null;
    this.state = {
      timeRange: {
        minTime: this.initialMinTime,
        maxTime: this.initialMaxTime,
      },
      isPlaying: false,
      playSpeed: 1000,
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
        showTasksAsCreated: getToggleDefault("showTasksAsCreated", false),
        showPlannedPaths: getToggleDefault("showPlannedPaths", false),
        showLiveJS: getToggleDefault("showLiveJS", false),
        showClientServerTimeDeltas: getToggleDefault("showClientServerTimeDeltas", false),
      },
      uploadedDatasets: [null, null, null],
      activeDatasetIndex: null,
    };
    // Realtime updates are too heavy.  There must be a better/ react way
    this.onSliderChangeDebounced = _.debounce((timeRange) => this.onSliderChange(timeRange), 25);

    // TODO: refactor so that visualizations are registered
    // rather than enumerated here?
    this.toggles = _.filter(
      [
        {
          id: "showGPSBubbles",
          name: "GPS Accuracy",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/GPSAccuracy.md",
          columns: ["lastlocation.rawlocationaccuracy", "lastlocation.locationsensor"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showHeading",
          name: "Heading",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Heading.md",
          columns: ["lastlocation.heading", "lastlocation.headingaccuracy"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showSpeed",
          name: "Speed",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Speed.md",
          columns: ["lastlocation.speed"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showTripStatus",
          name: "Trip Status",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/TripStatus.md",
          columns: [],
          solutionTypes: ["ODRD"],
        },
        {
          id: "showNavStatus",
          name: "Navigation Status",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/NavStatus.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showTasksAsCreated",
          name: "Tasks",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/Tasks.md",
          columns: [],
          solutionTypes: ["LMFS"],
        },
        {
          id: "showPlannedPaths",
          name: "Planned Paths",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/PlannedPaths.md",
          columns: [],
          solutionTypes: ["LMFS"],
        },
        {
          id: "showDwellLocations",
          name: "Dwell Locations",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/DwellTimes.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showHighVelocityJumps",
          name: "Jumps (unrealistic velocity)",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/VelocityJumps.md",
          columns: ["lastlocation.speed"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showMissingUpdates",
          name: "Jumps (Temporal)",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/MissingUpdates.md",
          columns: ["temporal_gap"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showClientServerTimeDeltas",
          name: "Client/Server Time Deltas",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
          columns: ["response.laslLocation.rawlocationlime", "response.laslLocation.serverlime"],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showETADeltas",
          name: "ETA Deltas",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/docs/EtaDeltas.md",
          columns: ["request.vehicle.etatofirstwaypoint"],
          solutionTypes: ["ODRD"],
        },
        {
          id: "showTraffic",
          name: "Live Traffic",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          id: "showLiveJS",
          name: "Live Journey Sharing",
          docLink: "https://github.com/googlemaps/fleet-debugger/blob/main/README.md",
          columns: [],
          solutionTypes: ["ODRD", "LMFS"],
        },
      ],
      (toggle) => {
        return toggle.solutionTypes.indexOf(this.props.logData.solutionType) !== -1;
      }
    );
    this.setFeaturedObject = this.setFeaturedObject.bind(this);
    this.setTimeRange = this.setTimeRange.bind(this);
  }

  /*
   * Update react state from data in the url.  This could/should be
   * cleaned up.  The pure react state is actually set properly in the
   * constructor ... all this does is update the map and associated
   * data (once it's loaded).  Given this split it's definitely possible
   * that this just overwrites settings a quickfingered user already
   * changed.
   */
  updateMapAndAssociatedData = () => {
    this.setTimeRange(this.state.timeRange.minTime, this.state.timeRange.maxTime);
    _.map(this.toggles, (toggle) => {
      const urlVal = getQueryStringValue(toggle.id);
      if (urlVal === "true") {
        this.updateToggleState(true, toggle.id, toggle.columns);
      }
    });
  };

  componentDidMount() {
    this.initializeData().then(() => {
      this.updateMapAndAssociatedData();
    });
    document.addEventListener("keydown", this.handleKeyPress);
  }

  initializeData = async () => {
    await this.checkUploadedDatasets();
    if (!this.state.uploadedDatasets[0]) {
      await this.checkForDemoFile();
    }
  };

  updateToggleState(newValue, toggleName, jsonPaths) {
    this.setState((prevState) => {
      prevState.toggleOptions[toggleName] = newValue;
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
    this.setFeaturedObject(selectedRow);
  }

  /*
   * Set the featured object
   */
  setFeaturedObject(featuredObject) {
    this.setState({ featuredObject: featuredObject });
  }

  setFocusOnRowFunction = (func) => {
    this.focusOnRowFunction = func;
  };

  focusOnSelectedRow = () => {
    if (this.focusOnRowFunction && this.state.featuredObject) {
      this.focusOnRowFunction(this.state.featuredObject);
    }
  };

  /*
   * exposes editing of the timeRange state
   */
  setTimeRange(minTime, maxTime, callback) {
    setQueryStringValue("minTime", minTime);
    setQueryStringValue("maxTime", maxTime);
    this.setState(
      {
        timeRange: {
          minTime: minTime,
          maxTime: maxTime,
        },
      },
      callback
    );
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

  selectFirstRow = () => {
    return new Promise((resolve) => {
      this.setState((prevState) => {
        const minDate = new Date(prevState.timeRange.minTime);
        const maxDate = new Date(prevState.timeRange.maxTime);
        const logs = this.props.logData.tripLogs.getLogs_(minDate, maxDate).value();

        if (logs.length > 0) {
          const firstRow = logs[0];
          setTimeout(() => this.focusOnSelectedRow(), 0);
          resolve(firstRow);
          return { featuredObject: firstRow };
        } else {
          console.log("selectFirstRow: No logs found in the current time range");
          resolve(null);
          return null;
        }
      });
    });
  };

  selectLastRow = () => {
    const minDate = new Date(this.state.timeRange.minTime);
    const maxDate = new Date(this.state.timeRange.maxTime);
    const logsWrapper = this.props.logData.tripLogs.getLogs_(minDate, maxDate);
    const logs = logsWrapper.value();

    if (logs.length > 0) {
      const lastRow = logs[logs.length - 1];
      this.setFeaturedObject(lastRow);
      this.focusOnRowFunction(lastRow);
    } else {
      console.log("selectLastRow: No logs found in the current time range");
    }
  };

  handleRowChange = async (direction) => {
    const { featuredObject } = this.state;
    const minDate = new Date(this.state.timeRange.minTime);
    const maxDate = new Date(this.state.timeRange.maxTime);
    const logs = this.props.logData.tripLogs.getLogs_(minDate, maxDate).value();

    let newFeaturedObject = featuredObject;

    const currentIndex = logs.findIndex((log) => log.timestamp === featuredObject.timestamp);
    if (direction === "next" && currentIndex < logs.length - 1) {
      newFeaturedObject = logs[currentIndex + 1];
    } else if (direction === "previous" && currentIndex > 0) {
      newFeaturedObject = logs[currentIndex - 1];
    }

    if (newFeaturedObject !== featuredObject) {
      this.setState({ featuredObject: newFeaturedObject }, () => {
        this.focusOnSelectedRow();
      });
    }
  };

  handleNextEvent = () => {
    this.handleRowChange("next");
  };

  handlePreviousEvent = () => {
    this.handleRowChange("previous");
  };

  handlePlayStop = () => {
    this.setState((prevState) => {
      if (!prevState.isPlaying) {
        this.timerID = setInterval(() => {
          this.handleNextEvent();
        }, prevState.playSpeed);
      } else {
        clearInterval(this.timerID);
      }
      return { isPlaying: !prevState.isPlaying };
    });
  };

  handleSpeedChange = (event) => {
    const newSpeed = parseInt(event.target.value);
    this.setState({ playSpeed: newSpeed });
  };

  handleKeyPress = (event) => {
    if (["ArrowLeft", ",", "<"].includes(event.key)) {
      this.handlePreviousEvent();
    } else if (["ArrowRight", ".", ">"].includes(event.key)) {
      this.handleNextEvent();
    }
  };

  componentWillUnmount() {
    clearInterval(this.timerID);
    document.removeEventListener("keydown", this.handleKeyPress);
  }

  checkForDemoFile = async () => {
    try {
      const response = await fetch("./data.json");
      if (!response.ok) {
        return;
      }
      console.log("data.json demo file found on the server root, saving it to Dataset 1");
      const blob = await response.blob();
      const file = new File([blob], "data.json", {
        type: "application/json",
      });
      const event = { target: { files: [file] } };
      await this.handleFileUpload(event, 0);
    } catch (error) {
      return;
    }
  };

  handleFileUpload = async (event, index) => {
    const file = event.target.files[0];
    log(`Attempting to upload file for button ${index}:`, file ? file.name : "No file selected");
    if (file) {
      try {
        log(`Uploading file ${file.name} for button ${index}`);
        await uploadFile(file, index);

        log(`File ${file.name} uploaded successfully for button ${index}`);
        this.setState((prevState) => {
          const newUploadedDatasets = [...prevState.uploadedDatasets];
          newUploadedDatasets[index] = "Uploaded";

          log(`Updated state for button ${index}:`, newUploadedDatasets);
          return {
            uploadedDatasets: newUploadedDatasets,
            activeDatasetIndex: index,
          };
        });
        this.switchDataset(index);
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  checkUploadedDatasets = async () => {
    const newUploadedDatasets = await Promise.all(
      [0, 1, 2].map(async (index) => {
        const data = await getUploadedData(index);
        log(`Dataset ${index}:`, data);
        if (data && data.rawLogs && Array.isArray(data.rawLogs) && data.rawLogs.length > 0) {
          return { status: "Uploaded", index };
        }
        return { status: null, index };
      })
    );

    this.setState({
      uploadedDatasets: newUploadedDatasets.map((d) => d.status),
    });

    if (this.state.activeDatasetIndex === null) {
      const firstAvailableIndex = newUploadedDatasets.find((dataset) => dataset.status === "Uploaded")?.index;
      if (firstAvailableIndex !== undefined) {
        this.switchDataset(firstAvailableIndex);
      }
    }
  };

  handleLongPress = async (index) => {
    log(`Long press detected for button ${index}`);
    try {
      log(`Attempting to delete data for button ${index}`);
      await deleteUploadedData(index);
      log(`Data deleted successfully for button ${index}`);
      this.setState((prevState) => {
        const newUploadedDatasets = [...prevState.uploadedDatasets];
        newUploadedDatasets[index] = null;
        log(`Updated state after deletion for button ${index}:`, newUploadedDatasets);
        return {
          uploadedDatasets: newUploadedDatasets,
          activeDatasetIndex: prevState.activeDatasetIndex === index ? null : prevState.activeDatasetIndex,
        };
      });
    } catch (error) {
      console.error("Error deleting uploaded data:", error);
      alert("Error deleting uploaded data. Please try again.");
    }
  };

  setCenterOnLocation = (func) => {
    this.centerOnLocation = func;
  };

  renderUploadButton = (index) => {
    const isUploaded = this.state.uploadedDatasets[index] === "Uploaded";
    const isActive = this.state.activeDatasetIndex === index;
    let timeoutId;

    const handleMouseDown = () => {
      timeoutId = setTimeout(() => {
        log(`Long press triggered for button ${index}`);
        this.handleLongPress(index);
      }, 3000);
    };

    const handleMouseUp = () => {
      clearTimeout(timeoutId);
    };

    const handleClick = () => {
      if (isUploaded) {
        this.switchDataset(index);
      } else {
        document.getElementById(`fileInput${index}`).click();
      }
    };

    return (
      <div
        key={index}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        style={{ display: "inline-block", marginRight: "10px" }}
      >
        <input
          type="file"
          accept=".zip,.json"
          onChange={(e) => this.handleFileUpload(e, index)}
          style={{ display: "none" }}
          id={`fileInput${index}`}
        />
        <button
          onClick={handleClick}
          style={{
            backgroundColor: isActive ? "#4CAF50" : isUploaded ? "#008CBA" : "#555555",
            color: "white",
            padding: "10px 20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isUploaded ? `Dataset ${index + 1}` : `Select File ${index + 1}`}
        </button>
      </div>
    );
  };

  switchDataset = async (index) => {
    log(`Attempting to switch to dataset ${index}`);

    if (this.state.uploadedDatasets[index] !== "Uploaded") {
      console.error(`Attempted to switch to dataset ${index}, but it's not uploaded or is empty`);
      return;
    }

    try {
      const data = await getUploadedData(index);
      if (data && data.rawLogs && Array.isArray(data.rawLogs) && data.rawLogs.length > 0) {
        const tripLogs = new TripLogs(data.rawLogs, data.solutionType);

        this.setState(
          {
            activeDatasetIndex: index,
            timeRange: {
              minTime: tripLogs.minDate.getTime(),
              maxTime: tripLogs.maxDate.getTime(),
            },
          },
          () => {
            // Update the logData prop with the new TripLogs instance
            this.props.logData.tripLogs = tripLogs;

            // Force an update of child components
            this.forceUpdate();

            log(`Switched to dataset ${index}`);
            log(`New time range: ${tripLogs.minDate} - ${tripLogs.maxDate}`);
          }
        );

        // Update map and associated data
        this.updateMapAndAssociatedData();
      } else {
        console.error(`Invalid or empty data structure for dataset ${index}`);
      }
    } catch (error) {
      console.error(`Error switching to dataset ${index}:`, error);
    }
  };

  toggleClickHandler(id) {
    const toggle = _.find(this.toggles, { id });
    const newValue = !this.state.toggleOptions[id];
    this.updateToggleState(newValue, id, toggle.columns);
  }

  render() {
    const selectedEventTime = this.state.featuredObject?.timestamp
      ? new Date(this.state.featuredObject.timestamp).getTime()
      : null;
    return (
      <div style={{ display: "flex", height: "100vh" }}>
        <div style={{ width: "70%", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "33vh", display: "flex", flexDirection: "column" }}>
            <div className="map-container" style={{ flex: 1 }}>
              <Map
                key={`map-${this.state.activeDatasetIndex}`}
                logData={this.props.logData}
                rangeStart={this.state.timeRange.minTime}
                rangeEnd={this.state.timeRange.maxTime}
                selectedRow={this.state.featuredObject}
                toggles={this.toggles}
                toggleOptions={this.state.toggleOptions}
                setFeaturedObject={this.setFeaturedObject}
                setTimeRange={this.setTimeRange}
                setCenterOnLocation={this.setCenterOnLocation}
              />
            </div>
            <TimeSlider
              logData={this.props.logData}
              curMin={this.state.timeRange.minTime}
              curMax={this.state.timeRange.maxTime}
              onSliderChange={this.onSliderChangeDebounced}
              selectedEventTime={selectedEventTime}
            />
            <ToggleBar
              toggles={this.toggles}
              toggleState={this.state.toggleOptions}
              clickHandler={(id) => this.toggleClickHandler(id)}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <div>
                    <button onClick={this.selectFirstRow}>First</button>
                    <button onClick={this.selectLastRow}>Last</button>
                    <button onClick={this.handlePreviousEvent}>&lt; Previous</button>
                    <button onClick={this.handleNextEvent}>Next &gt;</button>
                  </div>
                  <button onClick={this.handlePlayStop}>{this.state.isPlaying ? "Stop" : "Play"}</button>
                  <select
                    value={this.state.playSpeed}
                    onChange={this.handleSpeedChange}
                    disabled={this.state.isPlaying}
                  >
                    <option value="250">0.25 sec</option>
                    <option value="500">0.5 sec</option>
                    <option value="1000">1 sec</option>
                    <option value="2500">2.5 sec</option>
                    <option value="5000">5 sec</option>
                  </select>
                </div>
                <div style={{ display: "flex", marginLeft: "20px" }}>
                  {[0, 1, 2].map((index) => this.renderUploadButton(index))}
                </div>
                <div
                  style={{
                    marginLeft: "20px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div>Data remains client side, click and hold dataset to replace it</div>
                  <div>
                    <strong>&lt;</strong> and <strong>&gt;</strong> to quickly navigate selected events
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <LogTable
              logData={this.props.logData}
              style={{ width: "100%" }}
              timeRange={this.state.timeRange}
              extraColumns={this.state.extraColumns}
              onSelectionChange={(featuredObject) => this.onSelectionChange(featuredObject)}
              setFocusOnRowFunction={this.setFocusOnRowFunction}
              centerOnLocation={this.centerOnLocation}
            />
          </div>
        </div>
        <div style={{ width: "30%", height: "100%", overflow: "auto" }}>
          <Dataframe
            featuredObject={this.state.featuredObject}
            onClick={(select) => this.onDataframePropClick(select)}
          />
        </div>
      </div>
    );
  }
}

export { App as default };
