/*
 * src/TimeSlider.js
 *
 * Provides a time-based visualization of key events (vehicle status changes) as well
 * as filtering control for the log viewer & map view.
 */
import Slider from "rc-slider";
import { useMemo, useRef, useEffect, useState } from "react";
import "rc-slider/assets/index.css";
import _ from "lodash";
import { log } from "./Utils";

const { createSliderWithTooltip } = Slider;
const Range = createSliderWithTooltip(Slider.Range);

const style = { width: "100%" };

function TimeSlider(props) {
  const { logData, curMin, curMax, onSliderChange, selectedEventTime } = props;
  const tripLogs = logData.tripLogs;
  const sliderContainerRef = useRef(null);

  // State to track if we're currently in a dragging operation
  const [isDragging, setIsDragging] = useState(false);

  const marks = useMemo(() => {
    const result = {};

    // Add marks showing when trip status changed
    _.map(tripLogs.getTripStatusChanges(), (change) => {
      result[change.date.getTime()] = {
        style: { backgroundColor: "blue", width: "2px", height: "10px" },
        label: "",
      };
    });

    // Add mark for selected event
    if (selectedEventTime) {
      result[selectedEventTime] = {
        style: {},
        label: (
          <div className="selected-event-indicator-container">
            <svg className="selected-event-indicator" width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" fill="red" stroke="white" strokeWidth="2" />
            </svg>
          </div>
        ),
      };
    }

    return result;
  }, [tripLogs, selectedEventTime]);

  const minVal = tripLogs.minDate.getTime();
  const maxVal = tripLogs.maxDate.getTime();

  function onChange(value) {
    // Only process if not blocked by our overlay handling
    onSliderChange({ minTime: value[0], maxTime: value[1] });
  }

  function formatTooltip(value) {
    const d = new Date(value);
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    const formattedDateTime = d.toLocaleString("en-US", options);
    const tripStatus = tripLogs.getTripStatusAtDate(d);
    return `${formattedDateTime}\n${tripStatus}`;
  }

  // Function to select the closest event to a given time
  const selectClosestEvent = (clickTime) => {
    log(`TimeSlider - Finding closest event to: ${new Date(clickTime).toISOString()}`);

    // Find the closest event to this time
    const logs = tripLogs.getLogs_(new Date(minVal), new Date(maxVal)).value();

    if (logs.length > 0) {
      // Find closest log entry to the clicked time
      const closestLog = logs.reduce((closest, log) => {
        const logTime = new Date(log.timestamp).getTime();
        const currentDiff = Math.abs(clickTime - logTime);
        const closestDiff = Math.abs(clickTime - new Date(closest.timestamp).getTime());

        return currentDiff < closestDiff ? log : closest;
      });

      log(`TimeSlider - Found closest event at ${new Date(closestLog.timestamp).toISOString()}`);

      // Get the row index
      const rowIndex = logs.findIndex((log) => log.timestamp === closestLog.timestamp);

      // Select the log and focus the map
      if (props.onRowSelect) {
        props.onRowSelect(closestLog, rowIndex);

        // Center the map if a centerOnLocation function is available
        const lat = _.get(closestLog, "lastlocation.rawlocation.latitude");
        const lng = _.get(closestLog, "lastlocation.rawlocation.longitude");

        if (props.centerOnLocation && lat && lng) {
          props.centerOnLocation(lat, lng);
        }

        setTimeout(() => props.focusSelectedRow(), 0);
      }
    } else {
      log("TimeSlider - No logs found in current time range");
    }
  };

  // Use overlay approach to intercept clicks
  useEffect(() => {
    if (!sliderContainerRef.current) return;
    const container = sliderContainerRef.current;
    container.style.position = "relative";

    const overlay = document.createElement("div");
    overlay.className = "timeslider-overlay";
    container.appendChild(overlay);

    const handleOverlayClick = (e) => {
      const rect = container.getBoundingClientRect();
      const totalWidth = rect.width;
      const clickPosition = e.clientX - rect.left;
      const percentage = clickPosition / totalWidth;
      const timeRange = maxVal - minVal;
      const clickTime = Math.round(minVal + timeRange * percentage);

      selectClosestEvent(clickTime);

      // Stop propagation and prevent default for this non-passive listener
      e.stopPropagation();
      e.preventDefault();
    };

    overlay.addEventListener("mousedown", handleOverlayClick);
    overlay.addEventListener("touchstart", handleOverlayClick, { passive: false });

    // Add event listeners for handle drag detection
    const handleMouseDown = (e) => {
      if (e.target.classList.contains("rc-slider-handle")) {
        log("TimeSlider - Started dragging a handle");
        setIsDragging(true);

        // When dragging a handle, hide the overlay temporarily
        overlay.style.pointerEvents = "none";
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        log("TimeSlider - Ended handle drag");
        setIsDragging(false);

        // Re-enable the overlay after dragging
        setTimeout(() => {
          overlay.style.pointerEvents = "auto";
        }, 10);
      }
    };

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("touchstart", handleMouseDown, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp, { passive: true });

    return () => {
      // Remove overlay from DOM
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      overlay.removeEventListener("mousedown", handleOverlayClick);
      overlay.removeEventListener("touchstart", handleOverlayClick, { passive: false });
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("touchstart", handleMouseDown, { passive: true });
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp, { passive: true });
    };
  }, [minVal, maxVal, tripLogs, isDragging, props.onRowSelect, props.centerOnLocation]);

  return (
    <div style={style} ref={sliderContainerRef}>
      <Range
        min={minVal}
        max={maxVal}
        marks={marks}
        step={1}
        onChange={onChange}
        defaultValue={[minVal, maxVal]}
        value={[curMin, curMax]}
        tipFormatter={formatTooltip}
      />
    </div>
  );
}

export default TimeSlider;
