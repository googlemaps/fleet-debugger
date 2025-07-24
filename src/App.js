// src/App.js
import React from "react";
import { createRoot } from "react-dom/client";
import Map from "./Map";
import Dataframe from "./Dataframe";
import TimeSlider from "./TimeSlider";
import LogTable from "./LogTable";
import ToggleBar from "./ToggleBar";
import TripLogs from "./TripLogs";
import TaskLogs from "./TaskLogs";
import CloudLogging from "./CloudLogging";
import {
  uploadFile,
  getUploadedData,
  deleteUploadedData,
  uploadCloudLogs,
  saveDatasetAsJson,
  saveToIndexedDB,
} from "./localStorage";
import _ from "lodash";
import { getQueryStringValue, setQueryStringValue } from "./queryString";
import "./global.css";
import { log } from "./Utils";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ALL_TOGGLES, getVisibleToggles } from "./MapToggles";

const MARKER_COLORS = [
  "#EA4335", // Red
  "#E91E63", // Pink
  "#34A853", // Green
  "#FBBC05", // Yellow
  "#9C27B0", // Purple
  "#FF6D00", // Orange
  "#00BFA5", // Teal
  "#26A69A", // Darker Teal
];

class App extends React.Component {
  constructor(props) {
    super(props);
    this.centerOnLocation = null;
    this.renderMarkerOnMap = null;
    this.nextColorIndex = 0;
    const nowDate = new Date();
    let urlMinTime = getQueryStringValue("minTime");
    let urlMaxTime = getQueryStringValue("maxTime");
    this.initialMinTime = urlMinTime ? parseInt(urlMinTime) : 0;
    this.initialMaxTime = urlMaxTime ? parseInt(urlMaxTime) : nowDate.setFullYear(nowDate.getFullYear() + 1);
    this.focusOnRowFunction = null;
    this.state = {
      timeRange: { minTime: this.initialMinTime, maxTime: this.initialMaxTime },
      isPlaying: false,
      playSpeed: 1000,
      featuredObject: { msg: "Click a table row to select object" },
      extraColumns: [],
      toggleOptions: Object.fromEntries(ALL_TOGGLES.map((t) => [t.id, false])),
      uploadedDatasets: [null, null, null, null, null],
      activeDatasetIndex: null,
      activeMenuIndex: null,
      initialMapBounds: null,
      selectedRowIndexPerDataset: [-1, -1, -1, -1, -1],
      currentLogData: {
        ...this.props.logData,
        taskLogs: new TaskLogs(this.props.logData.tripLogs),
      },
      dynamicMarkerLocations: {},
      visibleToggles: getVisibleToggles(this.props.logData.solutionType),
    };
    this.onSliderChangeDebounced = _.debounce((timeRange) => this.onSliderChange(timeRange), 25);
    this.setFeaturedObject = this.setFeaturedObject.bind(this);
    this.setTimeRange = this.setTimeRange.bind(this);
  }

  updateMapAndAssociatedData = () => {
    this.setTimeRange(this.state.timeRange.minTime, this.state.timeRange.maxTime);
  };

  componentDidMount() {
    log(`Initial device pixel ratio: ${window.devicePixelRatio}`);
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
      const newToggleOptions = {
        ...prevState.toggleOptions,
        [toggleName]: newValue,
      };

      const newExtraColumns = newValue
        ? _.union(prevState.extraColumns, jsonPaths)
        : _.difference(prevState.extraColumns, jsonPaths);

      return {
        toggleOptions: newToggleOptions,
        extraColumns: newExtraColumns,
      };
    });
  }

  onSliderChange(timeRange) {
    this.setTimeRange(timeRange.minTime, timeRange.maxTime);
  }

  onSelectionChange(selectedRow, rowIndex) {
    if (this.state.activeDatasetIndex !== null && rowIndex !== undefined) {
      this.setState((prevState) => {
        const newSelectedIndexes = [...prevState.selectedRowIndexPerDataset];
        newSelectedIndexes[prevState.activeDatasetIndex] = rowIndex;
        return {
          selectedRowIndexPerDataset: newSelectedIndexes,
          featuredObject: selectedRow,
        };
      });
    } else {
      log("Unable to save index:", rowIndex, "for dataset:", this.state.activeDatasetIndex);
      this.setFeaturedObject(selectedRow);
    }
  }

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

  setTimeRange(minTime, maxTime, callback) {
    setQueryStringValue("minTime", minTime);
    setQueryStringValue("maxTime", maxTime);
    this.setState(
      {
        timeRange: { minTime: minTime, maxTime: maxTime },
      },
      callback
    );
  }

  /*
   * Callback to handle clicks on properties in the json viewer.
   * Adds/removes row from the log viewer based on which property
   * in the json object was clicked on
   */
  onDataframePropClick(jsonPath) {
    this.setState((prevState) => {
      let newColumns;
      if (_.find(prevState.extraColumns, (x) => x === jsonPath)) {
        newColumns = _.without(prevState.extraColumns, jsonPath);
      } else {
        newColumns = [...prevState.extraColumns, jsonPath];
      }
      return { extraColumns: newColumns };
    });
  }

  selectFirstRow = () => {
    return new Promise((resolve) => {
      this.setState((prevState) => {
        const minDate = new Date(prevState.timeRange.minTime);
        const maxDate = new Date(prevState.timeRange.maxTime);
        const logs = this.state.currentLogData.tripLogs.getLogs_(minDate, maxDate).value();
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
    const logsWrapper = this.state.currentLogData.tripLogs.getLogs_(minDate, maxDate);
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
    const logs = this.state.currentLogData.tripLogs.getLogs_(minDate, maxDate).value();
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
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
  }

  checkForDemoFile = async () => {
    try {
      const response = await fetch("./data.json");
      const contentType = response.headers.get("content-type");

      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        return;
      }
      console.log("data.json demo file found on the server root, saving it to Dataset 1");
      const blob = await response.blob();
      const file = new File([blob], "data.json", { type: "application/json" });
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
        this.setState(
          (prevState) => {
            const newUploadedDatasets = [...prevState.uploadedDatasets];
            newUploadedDatasets[index] = "Uploaded";
            log(`Updated dataset button state for index ${index}:`, newUploadedDatasets);
            return { uploadedDatasets: newUploadedDatasets };
          },
          () => {
            console.log(`handleFileUpload: setState callback executed for index ${index}, now switching dataset.`);
            this.switchDataset(index);
          }
        );
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  checkUploadedDatasets = async () => {
    const newUploadedDatasets = await Promise.all(
      [0, 1, 2, 3, 4].map(async (index) => {
        const data = await getUploadedData(index);
        log(`Dataset ${index}:`, data);
        if (data && data.rawLogs && Array.isArray(data.rawLogs) && data.rawLogs.length > 0) {
          return { status: "Uploaded", index };
        }
        return { status: null, index };
      })
    );
    this.setState(
      {
        uploadedDatasets: newUploadedDatasets.map((d) => d.status),
      },
      () => {
        if (this.state.activeDatasetIndex === null) {
          const firstAvailableIndex = newUploadedDatasets.find((dataset) => dataset.status === "Uploaded")?.index;
          if (firstAvailableIndex !== undefined) {
            this.switchDataset(firstAvailableIndex);
          }
        }
      }
    );
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

  renderUploadButton = (index) => {
    const isUploaded = this.state.uploadedDatasets[index] === "Uploaded";
    const isActive = this.state.activeDatasetIndex === index;
    const isMenuOpen = this.state.activeMenuIndex === index;

    const toggleMenu = (e) => {
      e.stopPropagation();
      log(`Toggle menu for dataset ${index}`);
      this.setState((prevState) => ({
        activeMenuIndex: prevState.activeMenuIndex === index ? null : index,
      }));
    };

    const handleDeleteClick = async (e) => {
      e.stopPropagation();
      log(`Delete initiated for dataset ${index}`);

      this.setState({ activeMenuIndex: null }); // Close menu

      try {
        await deleteUploadedData(index);
        log(`Data deleted successfully for dataset ${index}`);

        this.setState((prevState) => {
          const newUploadedDatasets = [...prevState.uploadedDatasets];
          newUploadedDatasets[index] = null;
          return {
            uploadedDatasets: newUploadedDatasets,
            activeDatasetIndex: prevState.activeDatasetIndex === index ? null : prevState.activeDatasetIndex,
          };
        });
      } catch (error) {
        console.error("Error deleting local storage data:", error);
        alert("Error deleting local storage data. Please try again.");
      }
    };

    const handleSaveClick = async (e) => {
      e.stopPropagation();
      log(`Export initiated for dataset ${index}`);

      // Close menu
      this.setState({ activeMenuIndex: null });

      try {
        await saveDatasetAsJson(index);
        toast.success(`Dataset ${index + 1} exported successfully`);
        log(`Dataset ${index} exported successfully`);
      } catch (error) {
        console.error("Error exporting dataset:", error);
        toast.error(`Error exporting dataset: ${error.message}`);
      }
    };

    const handlePruneClick = async (e) => {
      e.stopPropagation();
      log(`Prune initiated for dataset ${index}`);

      // Close menu
      this.setState({ activeMenuIndex: null });

      try {
        const { minTime, maxTime } = this.state.timeRange;
        const data = await getUploadedData(index);

        if (!data || !data.rawLogs || !Array.isArray(data.rawLogs)) {
          throw new Error("No valid data to prune");
        }

        // Calculate how many logs will be removed
        const originalLength = data.rawLogs.length;
        const minDate = new Date(minTime);
        const maxDate = new Date(maxTime);
        const remainingLogs = data.rawLogs.filter((log) => {
          const logTime = new Date(log.timestamp || log.insertTime);
          return logTime >= minDate && logTime <= maxDate;
        });

        const removeCount = originalLength - remainingLogs.length;

        if (
          !confirm(
            `This will remove ${removeCount} logs outside the selected time range.\nAre you sure you want to continue?`
          )
        ) {
          log("Prune operation cancelled by user");
          return;
        }

        log(`Pruning dataset ${index}: removing ${removeCount} logs outside time range`);

        data.rawLogs = remainingLogs;

        // Save the pruned dataset back to storage
        await saveToIndexedDB(data, index);

        // Update the current dataset if this is the active one
        if (this.state.activeDatasetIndex === index) {
          log(`handlePruneClick: Pruning active dataset ${index}, updating state.`);
          const tripLogs = new TripLogs(data.rawLogs, data.solutionType);
          const taskLogs = new TaskLogs(tripLogs);

          this.setState(
            (prevState) => ({
              currentLogData: {
                ...prevState.currentLogData,
                tripLogs: tripLogs,
                taskLogs: taskLogs,
                solutionType: data.solutionType,
              },
            }),
            () => {
              log("handlePruneClick: setState callback executed, selecting first row.");
              // Select first row after pruning
              this.selectFirstRow();
            }
          );
        }

        toast.success(`Dataset pruned: removed ${removeCount} logs outside the selected time range.`);
      } catch (error) {
        console.error("Error pruning dataset:", error);
        toast.error(`Error pruning dataset: ${error.message}`);
      }
    };

    const handleClick = async () => {
      if (isUploaded) {
        this.switchDataset(index);
      } else {
        log("Opening Cloud Logging dialog directly for index " + index);
        const result = await this.showCloudLoggingDialog();
        if (result) {
          try {
            if (result.file) {
              log("Processing file upload from dialog");
              const uploadEvent = { target: { files: [result.file] } };
              await this.handleFileUpload(uploadEvent, index);
            } else if (result.logs) {
              log("Processing cloud logs");
              await uploadCloudLogs(result.logs, index);
              this.setState((prevState) => ({
                uploadedDatasets: prevState.uploadedDatasets.map((dataset, i) => (i === index ? "Uploaded" : dataset)),
                activeDatasetIndex: index,
              }));
              this.switchDataset(index);
            }
          } catch (error) {
            console.error("Failed to process data:", error);
            alert("Failed to process data: " + error.message);
          }
        }
      }
    };

    // Close menu when clicking outside
    const handleOutsideClick = () => {
      if (isMenuOpen) {
        this.setState({ activeMenuIndex: null });
      }
    };

    // Add event listener for outside clicks when a menu is open
    if (isMenuOpen && !this._outsideClickHandler) {
      this._outsideClickHandler = () => {
        handleOutsideClick();
      };
      document.addEventListener("click", this._outsideClickHandler);
    } else if (!isMenuOpen && this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler);
      this._outsideClickHandler = null;
    }

    return (
      <div key={index} style={{ display: "inline-block", marginRight: "10px", position: "relative" }}>
        <input
          type="file"
          accept=".zip,.json"
          onChange={(e) => this.handleFileUpload(e, index)}
          style={{ display: "none" }}
          id={`fileInput${index}`}
        />
        <button
          onClick={handleClick}
          className={`dataset-button ${
            isActive ? "dataset-button-active" : isUploaded ? "dataset-button-uploaded" : "dataset-button-empty"
          }`}
        >
          {isUploaded ? `Dataset ${index + 1}` : `Select Dataset ${index + 1}`}

          {isUploaded && isActive && (
            <span className="dataset-button-actions" onClick={toggleMenu}>
              ▼
              {isMenuOpen && (
                <div className="dataset-button-menu">
                  <div className="dataset-button-menu-item export" onClick={handleSaveClick}>
                    Export
                  </div>
                  <div className="dataset-button-menu-item prune" onClick={handlePruneClick}>
                    Prune
                  </div>
                  <div className="dataset-button-menu-item delete" onClick={handleDeleteClick}>
                    Delete
                  </div>
                </div>
              )}
            </span>
          )}
        </button>
      </div>
    );
  };

  async showDataSourceDialog(index) {
    log("showDataSourceDialog");
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
        <div>
            <h3>Choose Data Source for Dataset ${index + 1}</h3>
            <button id="fileUpload">Load JSON/ZIP File</button>
            <button id="cloudLogging">Connect to Cloud Logging</button>
            <button id="cancel">Cancel</button>
        </div>
        `;
    document.body.appendChild(dialog);
    dialog.showModal();
    return new Promise((resolve) => {
      dialog.querySelector("#fileUpload").onclick = () => {
        dialog.remove();
        resolve("file");
      };
      dialog.querySelector("#cloudLogging").onclick = () => {
        dialog.remove();
        resolve("cloud");
      };
      dialog.querySelector("#cancel").onclick = () => {
        dialog.remove();
        resolve(null);
      };
    });
  }
  async showCloudLoggingDialog() {
    const dialog = document.createElement("dialog");
    dialog.className = "cloud-logging-dialog";

    document.body.appendChild(dialog);
    const dialogRootElement = document.createElement("div");
    dialog.appendChild(dialogRootElement);
    const dialogRoot = createRoot(dialogRootElement);
    dialog.showModal();
    return new Promise((resolve) => {
      const cleanupAndResolve = (result) => {
        dialogRoot.unmount();
        dialog.remove();
        resolve(result);
      };
      const handleError = (error) => {
        console.error("Cloud Logging Error:", error);
        toast.error(error.message || "Failed to fetch logs. Please try again.");
        cleanupAndResolve(null);
      };

      const handleFileUpload = (event) => {
        console.log("File upload selected from Cloud Logging dialog");
        const file = event?.target?.files?.[0];
        if (file) {
          cleanupAndResolve({ file });
        }
      };

      const cloudLoggingComponent = React.createElement(CloudLogging, {
        onLogsReceived: (logs) => {
          log(`Received ${logs.length} logs from Cloud Logging`);
          if (logs.length === 0) {
            toast.warning("No logs found matching your criteria.");
            cleanupAndResolve(null);
          } else {
            resolve({ logs });
            cleanupAndResolve({ logs });
          }
        },
        onFileUpload: handleFileUpload,
        setError: handleError,
      });
      dialogRoot.render(cloudLoggingComponent);
    });
  }

  setCenterOnLocation = (func) => {
    this.centerOnLocation = func;
  };

  setRenderMarkerOnMap = (func) => {
    this.renderMarkerOnMap = func;
  };

  toggleDynamicMarker = (location) => {
    log("App.js: toggleDynamicMarker called for location:", location);
    const locationKey = `${location.lat}_${location.lng}`;
    const markerState = this.state.dynamicMarkerLocations[locationKey];
    const shouldAdd = !markerState;

    if (shouldAdd) {
      const color = MARKER_COLORS[this.nextColorIndex];
      this.nextColorIndex = (this.nextColorIndex + 1) % MARKER_COLORS.length;

      if (this.renderMarkerOnMap) {
        this.renderMarkerOnMap(location, color, true);
      } else {
        console.error("renderMarkerOnMap function not available on App component");
        return;
      }

      this.setState((prevState) => {
        const newLocations = {
          ...prevState.dynamicMarkerLocations,
          [locationKey]: { location, color },
        };
        log(`App.js: Adding marker to state for key ${locationKey} with color ${color}`);
        return { dynamicMarkerLocations: newLocations };
      });
    } else {
      if (this.renderMarkerOnMap) {
        this.renderMarkerOnMap(location, markerState.color, false);
      }
      this.setState((prevState) => {
        const newLocations = { ...prevState.dynamicMarkerLocations };
        delete newLocations[locationKey];
        log(`App.js: Removing marker from state for key ${locationKey}`);
        return { dynamicMarkerLocations: newLocations };
      });
    }
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
        const taskLogs = new TaskLogs(tripLogs);
        const newVisibleToggles = getVisibleToggles(data.solutionType);

        let newToggleOptions = { ...this.state.toggleOptions };
        let newExtraColumns = [...this.state.extraColumns];

        if (data.solutionType === "LMFS") {
          const tasksToggleId = "showTasksAsCreated";
          const tasksToggle = _.find(ALL_TOGGLES, { id: tasksToggleId });
          if (tasksToggle && !newToggleOptions[tasksToggleId]) {
            log("Auto-enabling 'showTasksAsCreated' for LMFS dataset.");
            newToggleOptions[tasksToggleId] = true;
            newExtraColumns = _.union(newExtraColumns, tasksToggle.columns);
          }
        }

        this.setState(
          (prevState) => ({
            activeDatasetIndex: index,
            timeRange: { minTime: tripLogs.minDate.getTime(), maxTime: tripLogs.maxDate.getTime() },
            initialMapBounds: data.bounds,
            currentLogData: {
              ...prevState.currentLogData,
              tripLogs: tripLogs,
              taskLogs: taskLogs,
              solutionType: data.solutionType,
            },
            visibleToggles: newVisibleToggles,
            dynamicMarkerLocations: {}, // Clear markers when switching datasets
            toggleOptions: newToggleOptions,
            extraColumns: newExtraColumns,
          }),
          () => {
            log(`Switched to dataset ${index}`);
            log(`New time range: ${tripLogs.minDate} - ${tripLogs.maxDate}`);

            const savedRowIndex = this.state.selectedRowIndexPerDataset[index];
            log(`Attempting to restore row at index ${savedRowIndex} for dataset ${index}`);

            setTimeout(() => {
              if (savedRowIndex >= 0) {
                const minDate = new Date(this.state.timeRange.minTime);
                const maxDate = new Date(this.state.timeRange.maxTime);
                const logs = tripLogs.getLogs_(minDate, maxDate).value();

                if (savedRowIndex < logs.length) {
                  log(`Restoring row at index ${savedRowIndex}`);
                  const rowToSelect = logs[savedRowIndex];

                  this.setState({ featuredObject: rowToSelect }, () => {
                    this.focusOnSelectedRow();

                    const lat = _.get(rowToSelect, "lastlocation.rawlocation.latitude");
                    const lng = _.get(rowToSelect, "lastlocation.rawlocation.longitude");

                    if (lat && lng && this.centerOnLocation) {
                      log(`Centering map on restored row location: ${lat}, ${lng}`);
                      this.centerOnLocation(lat, lng);
                    } else {
                      log("Unable to center map: coordinates not found or centerOnLocation not available");
                    }
                  });
                } else {
                  log(`Index ${savedRowIndex} out of bounds (max: ${logs.length - 1}), selecting first row`);
                  this.selectFirstRow();
                }
              } else {
                log(`No previously saved row index for dataset ${index}, selecting first row`);
                this.selectFirstRow();
              }
            }, 300);

            this.updateMapAndAssociatedData();
          }
        );
      } else {
        console.error(`Invalid or empty data structure for dataset ${index}`);
      }
    } catch (error) {
      console.error(`Error switching to dataset ${index}:`, error);
    }
  };

  toggleClickHandler(id) {
    const toggle = _.find(ALL_TOGGLES, { id });
    const newValue = !this.state.toggleOptions[id];
    this.updateToggleState(newValue, id, toggle.columns);
  }

  render() {
    const {
      featuredObject,
      timeRange,
      currentLogData,
      toggleOptions,
      extraColumns,
      dynamicMarkerLocations,
      visibleToggles,
    } = this.state;
    const selectedEventTime = featuredObject?.timestamp ? new Date(featuredObject.timestamp).getTime() : null;

    return (
      <div className="app-container">
        <ToastContainer position="top-right" autoClose={5000} />
        <div className="main-content">
          <div className="map-and-control-section">
            <div className="map-container">
              <Map
                key={`map-${this.state.activeDatasetIndex}`}
                logData={currentLogData}
                rangeStart={timeRange.minTime}
                rangeEnd={timeRange.maxTime}
                selectedRow={featuredObject}
                toggles={visibleToggles}
                toggleOptions={toggleOptions}
                setFeaturedObject={this.setFeaturedObject}
                setTimeRange={this.setTimeRange}
                setCenterOnLocation={this.setCenterOnLocation}
                setRenderMarkerOnMap={this.setRenderMarkerOnMap}
                focusSelectedRow={this.focusOnSelectedRow}
                initialMapBounds={this.state.initialMapBounds}
              />
            </div>
            <TimeSlider
              logData={currentLogData}
              curMin={timeRange.minTime}
              curMax={timeRange.maxTime}
              onSliderChange={this.onSliderChangeDebounced}
              selectedEventTime={selectedEventTime}
              onRowSelect={(row, rowIndex) => this.onSelectionChange(row, rowIndex)}
              centerOnLocation={this.centerOnLocation}
              focusSelectedRow={this.focusOnSelectedRow}
            />
            <ToggleBar
              toggles={visibleToggles}
              toggleState={toggleOptions}
              clickHandler={(id) => this.toggleClickHandler(id)}
            />
            <div className="nav-controls">
              <div className="button-row">
                <div className="playback-controls">
                  <div>
                    <button onClick={this.selectFirstRow}>First</button>
                    <button onClick={this.selectLastRow}>Last</button>
                  </div>
                  <div>
                    <button onClick={this.handlePreviousEvent}>&lt;&nbsp;Previous</button>
                    <button onClick={this.handleNextEvent}>Next&nbsp;&gt;</button>
                  </div>
                  <div>
                    <button onClick={this.handlePlayStop}>{this.state.isPlaying ? "Stop" : "Play"}</button>
                    <select
                      value={this.state.playSpeed}
                      onChange={this.handleSpeedChange}
                      disabled={this.state.isPlaying}
                    >
                      <option value="250">0.25s</option>
                      <option value="500">0.5s</option>
                      <option value="1000">1s</option>
                      <option value="2500">2.5s</option>
                      <option value="5000">5s</option>
                    </select>
                  </div>
                </div>
                <div className="dataset-controls">{[0, 1, 2, 3, 4].map((index) => this.renderUploadButton(index))}</div>
                <div className="help-text">
                  <div>All Data remains client side</div>
                  <div>
                    <strong>&lt;</strong> and <strong>&gt;</strong> to quickly navigate selected events
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <LogTable
              logData={currentLogData}
              style={{ width: "100%" }}
              timeRange={timeRange}
              extraColumns={extraColumns}
              onSelectionChange={(rowData, rowIndex) => this.onSelectionChange(rowData, rowIndex)}
              setFocusOnRowFunction={this.setFocusOnRowFunction}
              centerOnLocation={this.centerOnLocation}
            />
          </div>
        </div>
        <div className="dataframe-section">
          <Dataframe
            featuredObject={featuredObject}
            extraColumns={extraColumns}
            onColumnToggle={(path) => this.onDataframePropClick(path)}
            onToggleMarker={this.toggleDynamicMarker}
            dynamicMarkerLocations={dynamicMarkerLocations}
          />
        </div>
      </div>
    );
  }
}
export { App as default };
