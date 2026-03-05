// src/PolylineCreation.js

import { useState, useEffect, useRef } from "react";
import { parsePolylineInput, calculatePolylineDistanceMeters } from "./PolylineUtils";
import { log, formatDistance } from "./Utils";

function PolylineCreation({ map, onSubmit, onClose, buttonPosition }) {
  const [input, setInput] = useState("");
  const [opacity, setOpacity] = useState(0.7);
  const [color, setColor] = useState("#FF0000");
  const [strokeWeight, setStrokeWeight] = useState(6);
  const [distanceUnit, setDistanceUnit] = useState("metric");

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [points, setPoints] = useState([]);
  const polylineRef = useRef(null);
  const markersRef = useRef([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const validWaypoints = parsePolylineInput(input);
      log(`Parsed ${validWaypoints.length} valid waypoints`);
      onSubmit(validWaypoints, { opacity, color, strokeWeight });
      setInput("");
    } catch (error) {
      log("Invalid input format:", error);
    }
  };

  let placeholder = `Paste waypoints here:
{ latitude: 52.5163, longitude: 13.2399 },
{ latitude: 52.5162, longitude: 13.2400 }

Or paste an encoded S2 or Google Maps polyline string`;

  useEffect(() => {
    if (!map || !isMeasuring) return;

    log("MeasureMode: Attaching click listener");
    const clickListener = map.addListener("click", (e) => {
      setPoints((prev) => [...prev, e.latLng]);
    });

    map.setOptions({ draggableCursor: "crosshair" });

    return () => {
      window.google.maps.event.removeListener(clickListener);
      if (map) {
        map.setOptions({ draggableCursor: null });
      }
    };
  }, [map, isMeasuring]);

  useEffect(() => {
    if (!map || !isMeasuring) return;

    if (!polylineRef.current) {
      polylineRef.current = new window.google.maps.Polyline({
        map,
        path: points,
        strokeColor: color,
        strokeOpacity: opacity,
        strokeWeight: strokeWeight,
        geodesic: true,
      });
    } else {
      polylineRef.current.setPath(points);
      polylineRef.current.setOptions({ strokeColor: color, strokeOpacity: opacity, strokeWeight });
    }

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = points.map((p, i) => {
      let label = (i + 1).toString();

      return new window.google.maps.Marker({
        map,
        position: p,
        label: {
          text: label,
          color: "white",
          fontSize: "12px",
          fontWeight: "bold",
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#FFFFFF",
        },
        zIndex: 1000,
      });
    });
  }, [points, map, isMeasuring, color, opacity, strokeWeight]);

  useEffect(() => {
    if (!isMeasuring) {
      setPoints([]);
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
      markersRef.current.forEach((m) => m.setMap(null));
    };
  }, [isMeasuring]);

  const handleCreateFromMeasure = () => {
    if (points.length < 2) return;
    const formattedPoints = points.map((p) => ({ latitude: p.lat(), longitude: p.lng() }));

    const distanceMeters = calculatePolylineDistanceMeters(formattedPoints);

    onSubmit(formattedPoints, { opacity, color, strokeWeight, distanceMeters, distanceUnit });
    setIsMeasuring(false);
  };

  const distanceMeters =
    points.length > 1
      ? calculatePolylineDistanceMeters(points.map((p) => ({ latitude: p.lat(), longitude: p.lng() })))
      : 0;
  const { metric, imperial } = formatDistance(distanceMeters);

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
          rows={5}
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
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
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
        <div style={{ margin: "5px" }}>
          <label>Distance Marker:</label>
          <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
            <label>
              <input
                type="radio"
                value="metric"
                checked={distanceUnit === "metric"}
                onChange={(e) => setDistanceUnit(e.target.value)}
              />
              Metric
            </label>
            <label>
              <input
                type="radio"
                value="imperial"
                checked={distanceUnit === "imperial"}
                onChange={(e) => setDistanceUnit(e.target.value)}
              />
              Imperial
            </label>
            <label>
              <input
                type="radio"
                value="none"
                checked={distanceUnit === "none"}
                onChange={(e) => setDistanceUnit(e.target.value)}
              />
              None
            </label>
          </div>
        </div>
        <div style={{ margin: "5px", padding: "10px", backgroundColor: "#f5f5f5", borderRadius: "5px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
            <label>
              <input type="checkbox" checked={isMeasuring} onChange={(e) => setIsMeasuring(e.target.checked)} />
              Enable Map Clicking (Measure)
            </label>
            {isMeasuring && <span style={{ fontSize: "12px", color: "#666" }}>Points: {points.length}</span>}
          </div>
          {isMeasuring && points.length > 1 && (
            <div style={{ marginTop: "5px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "bold", color: "#222" }}>{metric}</span>
              <span style={{ fontWeight: "bold", color: "#222" }}>{imperial}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
          {isMeasuring ? (
            <button
              type="button"
              className="map-button inner-button"
              onClick={handleCreateFromMeasure}
              style={{ flex: 1 }}
              disabled={points.length < 2}
            >
              Create Polyline
            </button>
          ) : (
            <button
              type="submit"
              className="map-button inner-button"
              style={{ flex: 1 }}
              disabled={input.trim() === ""}
            >
              Create Polyline
            </button>
          )}
          <button type="button" className="map-button inner-button" onClick={onClose} style={{ flex: 1 }}>
            Close
          </button>
        </div>
      </form>
    </div>
  );
}

export default PolylineCreation;
