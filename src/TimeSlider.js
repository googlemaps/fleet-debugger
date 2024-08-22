/*
 * TimeSlider.js
 *
 * Provides a time-based visualaziton of key events (vehicle status changes) as well
 * as filtering control for the log viewer & map view.
 *
 * TODO: not clear that rc-slider is actually the correct/best component for this
 * functionality
 */
import Slider from "rc-slider";
import { useMemo } from "react";
import "rc-slider/assets/index.css";
import _ from "lodash";

const { createSliderWithTooltip } = Slider;
const Range = createSliderWithTooltip(Slider.Range);

const style = { width: "100%" };

function TimeSlider(props) {
  const { logData, curMin, curMax, onSliderChange, selectedEventTime } = props;
  const tripLogs = logData.tripLogs;

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
            <svg
              className="selected-event-indicator"
              width="20"
              height="20"
              viewBox="0 0 20 20"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                fill="red"
                stroke="white"
                strokeWidth="2"
              />
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
    onSliderChange({
      minTime: value[0],
      maxTime: value[1],
    });
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

  return (
    <div style={style}>
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
