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
import "rc-slider/assets/index.css";
import _ from "lodash";

const { createSliderWithTooltip } = Slider;
const Range = createSliderWithTooltip(Slider.Range);

const style = { width: "100%" };

function TimeSlider(props) {
  const tripLogs = props.logData.tripLogs;
  const marks = {};

  // Add marks showing when trip status changed.
  // Ideally label by trip status change ... but labels overrun & look ugly
  _.map(tripLogs.getTripStatusChanges(), (change) => {
    marks[change.date.getTime()] = {};
  });

  const minVal = tripLogs.minDate.getTime();
  const maxVal = tripLogs.maxDate.getTime();

  const curMin = _.max([minVal, props.curMin]);
  const curMax = _.min([maxVal, props.curMax]);

  function onChange(value) {
    props.onSliderChange({
      minTime: value[0],
      maxTime: value[1],
    });
  }

  function formatTooltip(value) {
    const d = new Date(value);
    const tripStatus = tripLogs.getTripStatusAtDate(new Date(value));
    return `${d}${tripStatus}`;
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
