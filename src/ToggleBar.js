/*
 * src/ToggleBar.js
 *
 * Row of buttons that configure visualization options on the map
 */
import _ from "lodash";

function ToggleBar(props) {
  const toggleState = props.toggleState;
  const toggles = _.map(props.toggles, (toggle) => {
    return (
      <button
        key={toggle.id}
        className={`toggle-button ${toggleState[toggle.id] ? "toggle-button-active" : ""}`}
        onClick={() => props.clickHandler(toggle.id)}
      >
        {toggle.name}
        <a href={toggle.docLink} target="_blank" rel="noreferrer">
          ?
        </a>
      </button>
    );
  });

  return <div className="togglebar-button-group">{toggles}</div>;
}

export default ToggleBar;
