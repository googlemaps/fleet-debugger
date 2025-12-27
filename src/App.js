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
import DatasetLoading from "./DatasetLoading";
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
import Utils, { log } from "./Utils";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ALL_TOGGLES, getVisibleToggles } from "./MapToggles";
import { HAS_EXTRA_DATA_SOURCE } from "./constants";

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

const ODRD_FILTERS = ["createVehicle", "getVehicle", "updateVehicle", "createTrip", "getTrip", "updateTrip"];

function FilterBar({ availableFilters, filterState, clickHandler }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const filterBarRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (filterBarRef.current && !filterBarRef.current.contains(event.target)) {
        log("Clicked outside FilterBar, closing menu.");
        setIsOpen(false);
      }
    }
    if (isOpen) {
      log("Filter menu is open, adding click outside listener.");
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  if (!availableFilters || availableFilters.length === 0) {
    return null;
  }

  const handleButtonClick = () => {
    log(`Filter button clicked. Menu will be ${!isOpen ? "opened" : "closed"}.`);
    setIsOpen(!isOpen);
  };

  const activeFilterCount = availableFilters.filter((type) => filterState[type]).length;
  const totalFilterCount = availableFilters.length;
  const buttonText = `Filter Log Types (${activeFilterCount}/${totalFilterCount})`;
  const isFiltered = activeFilterCount !== totalFilterCount;

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={filterBarRef}>
      <button
        className={`toggle-button ${isOpen || isFiltered ? "toggle-button-active" : ""}`}
        onClick={handleButtonClick}
      >
        {buttonText}
      </button>
      {isOpen && (
        <div className="filter-menu">
          {availableFilters.map((filterType) => (
            <label key={filterType} className="filter-menu-item">
              <input type="checkbox" checked={!!filterState[filterType]} onChange={() => clickHandler(filterType)} />
              {filterType}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function TripIdFilter({ value, onChange }) {
  return (
    <div style={{ marginLeft: "10px" }}>
      <input
        type="text"
        placeholder="Filter by Trip ID"
        value={value}
        onChange={onChange}
        className="trip-id-filter-input"
      />
    </div>
  );
}

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
      filters: {
        logTypes: {
          createVehicle: true,
          getVehicle: true,
          updateVehicle: true,
          createTrip: true,
          getTrip: true,
          updateTrip: true,
          createDeliveryVehicle: true,
          getDeliveryVehicle: true,
          updateDeliveryVehicle: true,
          createTask: true,
          getTask: true,
          updateTask: true,
        },
        tripId: "",
      },
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
        const logs = this.state.currentLogData.tripLogs.getLogs_(minDate, maxDate, prevState.filters).value();
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
    const logsWrapper = this.state.currentLogData.tripLogs.getLogs_(minDate, maxDate, this.state.filters);
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
    const { featuredObject, filters } = this.state;
    const minDate = new Date(this.state.timeRange.minTime);
    const maxDate = new Date(this.state.timeRange.maxTime);
    const logs = this.state.currentLogData.tripLogs.getLogs_(minDate, maxDate, filters).value();
    let newFeaturedObject = featuredObject;
    const currentIndex = logs.findIndex((log) => log.timestamp === featuredObject.timestamp);

    if (currentIndex === -1) {
      if (logs.length > 0) {
        newFeaturedObject = logs[0];
      } else {
        return;
      }
    } else if (direction === "next" && currentIndex < logs.length - 1) {
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
          if (HAS_EXTRA_DATA_SOURCE && data.retentionDate) {
            const retentionDate = new Date(data.retentionDate);
            if (retentionDate <= new Date()) {
              log(`Startup: Dataset ${index} expired. Deleting...`);
              await deleteUploadedData(index);
              log(`Dataset ${index + 1} has expired and was deleted.`, "error");
              return { status: null, index };
            } else {
              const now = new Date();
              const timeLeftMs = retentionDate - now;
              const daysLeft = timeLeftMs / (1000 * 60 * 60 * 24);
              if (daysLeft <= 10) {
                log(`Dataset ${index + 1} will expire in ${Utils.formatTTLRemaining(timeLeftMs)}.`, "warn");
              }
            }
          }
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

  renderUploadButton = (index) => {
    const isUploaded = this.state.uploadedDatasets[index] === "Uploaded";
    const isActive = this.state.activeDatasetIndex === index;
    const isMenuOpen = this.state.activeMenuIndex === index;

    const toggleMenu = (e) => {
      e.stopPropagation();
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
        log("Error deleting local storage data. Please try again.", error);
      }
    };

    const handleSaveClick = async (e) => {
      e.stopPropagation();
      log(`Export initiated for dataset ${index}`);
      this.setState({ activeMenuIndex: null }); // Close menu

      try {
        await saveDatasetAsJson(index);
        log(`Dataset ${index + 1} exported successfully`, "success");
      } catch (error) {
        log(`Error exporting dataset: ${error.message}`, error);
      }
    };

    const handlePruneClick = async (e) => {
      e.stopPropagation();
      log(`Prune initiated for dataset ${index}`);
      this.setState({ activeMenuIndex: null }); // Close menu

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

        await saveToIndexedDB(data, index); // Save the pruned dataset back to storage

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
              this.selectFirstRow(); // Select first row after pruning
            }
          );
        }

        log(`Dataset pruned: removed ${removeCount} logs outside the selected time range.`, "info");
      } catch (error) {
        log(`Error pruning dataset: ${error.message}`, error);
      }
    };

    const handleClick = async () => {
      if (isUploaded) {
        this.switchDataset(index);
      } else {
        const result = await this.showDatasetLoadingDialog();
        if (!result) {
          log("Dataset loading dialog was cancelled or returned no data.");
          return; // User cancelled the dialog
        }

        try {
          if (result.file) {
            const uploadEvent = { target: { files: [result.file] } };
            await this.handleFileUpload(uploadEvent, index);
            return;
          }

          let logsToProcess;
          if (result.logs) {
            logsToProcess = result.logs;
          } else if (result.extraLogs) {
            // The 'extraLogs' are raw payloads, so we wrap them in the structure
            // that our uploader and processor expects ({ jsonPayload: ... }).
            logsToProcess = result.extraLogs.map((logEntry) => ({
              jsonPayload: logEntry,
              timestamp: logEntry.timestamp,
            }));
          }

          if (logsToProcess) {
            await uploadCloudLogs(logsToProcess, index);
            this.setState(
              (prevState) => {
                const newUploadedDatasets = [...prevState.uploadedDatasets];
                newUploadedDatasets[index] = "Uploaded";
                return { uploadedDatasets: newUploadedDatasets };
              },
              () => this.switchDataset(index)
            );
          }
        } catch (error) {
          log(`Failed to process data from dialog: ${error.message}`, error);
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
  async showDatasetLoadingDialog() {
    log("Executing showDatasetLoadingDialog");
    const dialog = document.createElement("dialog");
    dialog.className = "cloud-logging-dialog";

    document.body.appendChild(dialog);
    const dialogRootElement = document.createElement("div");
    dialog.appendChild(dialogRootElement);
    const dialogRoot = createRoot(dialogRootElement);
    dialog.showModal();

    return new Promise((resolve) => {
      const cleanupAndResolve = (result) => {
        log("Closing and cleaning up DatasetLoading dialog");
        dialogRoot.unmount();
        dialog.remove();
        resolve(result);
      };
      dialog.addEventListener("close", () => {
        cleanupAndResolve(null);
      });

      const handleFileUpload = (event) => {
        log("File upload selected from DatasetLoading dialog");
        const file = event?.target?.files?.[0];
        if (file) {
          cleanupAndResolve({ file });
        }
      };

      const handleCloudLogsReceived = (logs) => {
        log(`Received ${logs.length} logs from Cloud Logging`);
        if (logs.length > 0) {
          cleanupAndResolve({ logs });
        } else {
          // If no logs, we don't close the dialog, just show a toast.
          // The user might want to adjust params.
          toast.warning("No logs found matching your criteria.");
        }
      };

      const handleExtraLogsReceived = (logs) => {
        log(`Received logs from extra data source`);
        if (logs) {
          cleanupAndResolve({ extraLogs: logs });
        } else {
          toast.warning("No logs found from the extra data source.");
        }
      };

      const datasetLoadingComponent = React.createElement(DatasetLoading, {
        onLogsReceived: handleCloudLogsReceived,
        onExtraLogsReceived: handleExtraLogsReceived,
        onFileUpload: handleFileUpload,
      });
      dialogRoot.render(datasetLoadingComponent);
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

  checkAndEnforceTTL = async (index) => {
    if (!HAS_EXTRA_DATA_SOURCE) return "Valid";

    try {
      const data = await getUploadedData(index);
      if (!data) {
        log(`Dataset ${index + 1} not found in storage. It may have expired or been deleted.`, "error");
        this.setState((prevState) => {
          const newUploadedDatasets = [...prevState.uploadedDatasets];
          newUploadedDatasets[index] = null;
          return {
            uploadedDatasets: newUploadedDatasets,
            activeDatasetIndex: prevState.activeDatasetIndex === index ? null : prevState.activeDatasetIndex,
          };
        });
        return "Expired";
      }

      if (!data.retentionDate) return "Valid";

      const retentionDate = new Date(data.retentionDate);
      const now = new Date();
      const timeLeftMs = retentionDate - now;
      const daysLeft = timeLeftMs / (1000 * 60 * 60 * 24);

      if (timeLeftMs <= 0) {
        log(`Dataset ${index} expired. Deleting...`);
        await deleteUploadedData(index);
        this.setState((prevState) => {
          const newUploadedDatasets = [...prevState.uploadedDatasets];
          newUploadedDatasets[index] = null;
          return {
            uploadedDatasets: newUploadedDatasets,
            activeDatasetIndex: prevState.activeDatasetIndex === index ? null : prevState.activeDatasetIndex,
          };
        });
        log(`Dataset ${index + 1} has expired and was deleted (Retention limit reached).`, "error");
        return "Expired";
      } else if (daysLeft <= 10) {
        log(`Dataset ${index + 1} will expire in ${Utils.formatTTLRemaining(timeLeftMs)}.`, "warn");
        return "Warning";
      }
      return "Valid";
    } catch (e) {
      console.error("Error verifying TTL:", e);
      return "Error";
    }
  };

  switchDataset = async (index) => {
    log(`Attempting to switch to dataset ${index}`);

    const ttlStatus = await this.checkAndEnforceTTL(index);
    if (ttlStatus === "Expired") return;

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

  handleLogTypeFilterChange = (filterType) => {
    this.setState((prevState) => ({
      filters: {
        ...prevState.filters,
        logTypes: {
          ...prevState.filters.logTypes,
          [filterType]: !prevState.filters.logTypes[filterType],
        },
      },
    }));
  };

  handleTripIdFilterChange = (event) => {
    const newTripId = event.target.value;
    this.setState((prevState) => ({
      filters: {
        ...prevState.filters,
        tripId: newTripId,
      },
    }));
  };

  render() {
    const {
      featuredObject,
      timeRange,
      currentLogData,
      toggleOptions,
      extraColumns,
      dynamicMarkerLocations,
      visibleToggles,
      filters,
    } = this.state;
    const selectedEventTime = featuredObject?.timestamp ? new Date(featuredObject.timestamp).getTime() : null;
    const availableFilters = currentLogData.solutionType === "ODRD" ? ODRD_FILTERS : [];

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
                filters={filters}
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
              filters={filters}
            />
            <div className="togglebar-button-group">
              <ToggleBar
                toggles={visibleToggles}
                toggleState={toggleOptions}
                clickHandler={(id) => this.toggleClickHandler(id)}
              />
              <FilterBar
                availableFilters={availableFilters}
                filterState={filters.logTypes}
                clickHandler={this.handleLogTypeFilterChange}
              />
              <TripIdFilter value={filters.tripId} onChange={this.handleTripIdFilterChange} />
            </div>
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
              filters={filters}
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
