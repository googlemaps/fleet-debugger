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
const marks = {};

function TimeSlider(props) {
  const rawLogs = props.logData.rawLogs;
  let lastState = undefined;
  let lastStatus = undefined;
  const stateChanges = [];
  const statusChanges = [];
  // TODO: Ideally separetly styled marks for the main status changes:
  // vehicle status, trip state, navigation status
  //
  // TODO State and status changes really need a view of the logs
  // processed for an entire trip.   With that information
  // it might be possible to color the ranges in the slider
  // separately (ie green or enroute to pickup, red for enroute to dropoff)
  _.forEach(rawLogs, (le) => {
    const state = _.get(le, "jsonPayload.response.state");
    if (state !== lastState) {
      stateChanges.push({
        timestampMS: le.timestampMS,
        newState: state,
      });
      lastState = state;
    }
    const status = _.get(le, "jsonPayload.response.status");
    if (status !== lastStatus) {
      statusChanges.push({
        timestampMS: le.timestampMS,
        newStatus: status,
      });
      marks[le.timestampMS] = {};
      lastStatus = status;
    }
  });

  const maxVal = rawLogs[0].timestampMS;
  const minVal = _.last(rawLogs).timestampMS;

  function onChange(value) {
    props.onSliderChange({
      minDate: value[0],
      maxDate: value[1],
    });
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
        tipFormatter={(value) => `${new Date(value)}%`}
      />
    </div>
  );
}

export default TimeSlider;
