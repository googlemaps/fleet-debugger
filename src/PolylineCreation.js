// PolylineCreation.js

import { useState } from "react";

function PolylineCreation({ onSubmit, onClose, buttonPosition }) {
  const [input, setInput] = useState("");
  const [opacity, setOpacity] = useState(0.7);
  const [color, setColor] = useState("#FF0000");
  const [strokeWeight, setStrokeWeight] = useState(6);

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const trimmedInput = input.trim();
      const jsonString = trimmedInput
        .replace(/(\w+):/g, '"$1":')
        .replace(/\s+/g, " ");

      const inputWithBrackets =
        jsonString.startsWith("[") && jsonString.endsWith("]")
          ? jsonString
          : `[${jsonString}]`;

      const waypoints = JSON.parse(inputWithBrackets);

      const validWaypoints = waypoints.filter(
        (waypoint) =>
          typeof waypoint === "object" &&
          "latitude" in waypoint &&
          "longitude" in waypoint &&
          typeof waypoint.latitude === "number" &&
          typeof waypoint.longitude === "number"
      );

      if (validWaypoints.length === 0) {
        throw new Error("No valid waypoints found");
      }

      console.log(`Parsed ${validWaypoints.length} valid waypoints`);
      onSubmit(validWaypoints, { opacity, color, strokeWeight });
    } catch (error) {
      console.error("Invalid input format:", error);
    }
    setInput("");
  };

  let placeholder = `Paste waypoints here:
{ latitude: 52.5163, longitude: 13.2399 },
{ latitude: 52.5162, longitude: 13.2400 }`;

  return (
    <div
      style={{
        position: "absolute",
        top: `${buttonPosition.top + 8}px`,
        left: `${buttonPosition.left}px`,
        zIndex: 1000,
        backgroundColor: "white",
        padding: "10px",
        borderRadius: "5px",
        width: "400px",
      }}
    >
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{ width: "100%", boxSizing: "border-box" }}
        />
        <div style={{ margin: "5px" }}>
          <label>
            Opacity:
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
            />
            {opacity.toFixed(1)}
          </label>
        </div>
        <div style={{ margin: "5px" }}>
          <label>
            Color:
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </label>
        </div>
        <div style={{ margin: "5px" }}>
          <label>
            Stroke Weight:
            <input
              type="number"
              min="1"
              max="20"
              value={strokeWeight}
              onChange={(e) => setStrokeWeight(parseInt(e.target.value))}
            />
          </label>
        </div>
        <button type="submit" className="map-button inner-button">
          Create Polyline
        </button>
        <button
          type="button"
          className="map-button inner-button"
          onClick={onClose}
        >
          Close
        </button>
      </form>
    </div>
  );
}

export default PolylineCreation;
