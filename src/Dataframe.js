/*
 * src/Dataframe.js
 *
 * JSON viewer for log entries.   Clicking on a property _value_
 * adds it to the log viewer.
 *
 */
import ReactJson from "react-json-view";

function Dataframe(props) {
  return (
    <ReactJson
      src={props.featuredObject}
      onSelect={props.onClick}
      shouldCollapse={(field) => {
        if (field.name === "root") {
          return false;
        }

        if (field.name === "request" && field.namespace[0] === "root") {
          return false;
        }

        if (field.name === "vehicle" && field.namespace[0] === "root" && field.namespace[1] === "request") {
          return false;
        }

        // Collapse everything else
        return true;
      }}
    />
  );
}

// TODO: Ideas: allow selecting a field and see how it changes along the map
// or the slider (ie view on map / view on slider)
// or 'add slider' that instantiates a slider that has marks
// when that value changes
export default Dataframe;
