/*
 * src/Dataframe.js
 *
 * JSON viewer for log entries.   Clicking on a property _value_
 * adds it to the log viewer.
 *
 * TODO: support clicking on the property name as well, or support an
 * icon or other UI element (similar to copy to clip board).
 */
import ReactJson from "react-json-view";
function Dataframe(props) {
  return <ReactJson src={props.featuredObject} onSelect={props.onClick} />;
}

// TODO: Ideas: allow selecting a field and see how it changes along the map
// or the slider (ie view on map / view on slider)
// or 'add slider' that instantiates a slider that has marks
// when that value changes
export default Dataframe;
