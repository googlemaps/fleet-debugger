// src/Dataframe.js
import { useCallback } from "react";
import JsonView from "react18-json-view";
import "react18-json-view/src/style.css";
import { log } from "./Utils";
import { toast } from "react-toastify";
import _ from "lodash";

// We'll use this list to prevent users from adding default columns again.
const DEFAULT_COLUMN_PATHS = [
  "formattedDate",
  "@type",
  "lastlocation.rawlocationsensor",
  "lastlocation.locationsensor",
  "response.vehiclestate",
  "response.state",
  "response.tripstatus",
  "request.deliveryvehicle.remainingdistancemeters",
  "navStatus",
];

// Helper to check if a value is a location object
const isLocationObject = (value) => {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "latitude") &&
    Object.prototype.hasOwnProperty.call(value, "longitude") &&
    typeof value.latitude === "number" &&
    typeof value.longitude === "number"
  );
};

const MarkerIcon = ({ color }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
  </svg>
);

// Stateless component to render a button for location objects
const LocationButton = ({ color, onToggle }) => {
  const isAdded = color !== "lightgrey";
  const handleToggle = (e) => {
    e.stopPropagation();
    log(`LocationButton: Toggle marker clicked. Marker will be ${isAdded ? "removed" : "added"}.`);
    onToggle();
  };

  return (
    <button
      onClick={handleToggle}
      title={isAdded ? "Remove from map" : "Show on map"}
      style={{
        marginLeft: "4px",
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: "0",
        display: "inline-flex",
        alignItems: "center",
        verticalAlign: "middle",
      }}
    >
      <MarkerIcon color={color} />
    </button>
  );
};

const AddColumnButton = (props) => {
  return (
    <button
      {...props}
      title="Add/Remove as column in LogTable"
      style={{
        cursor: "pointer",
        background: "none",
        border: "none",
        color: "var(--json-property)",
        fontWeight: "bold",
        padding: "0 4px",
      }}
    >
      +
    </button>
  );
};

function Dataframe({ featuredObject, extraColumns, onColumnToggle, onToggleMarker, dynamicMarkerLocations }) {
  const handleCopyRoot = useCallback(() => {
    if (!featuredObject) return;
    const objectToCopy = _.omit(featuredObject, ["lastlocation", "lastlocationResponse"]);

    const jsonString = JSON.stringify(objectToCopy, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
        toast.success("Object copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy object: ", err);
        toast.error("Failed to copy object.");
      });
  }, [featuredObject]);

  const CustomLocationOperation = useCallback(
    ({ node }) => {
      if (isLocationObject(node)) {
        log("Dataframe: Rendering location button for node.");
        const locationKey = `${node.latitude}_${node.longitude}`;
        const markerState = dynamicMarkerLocations[locationKey];
        const color = markerState ? markerState.color : "lightgrey";

        return (
          <LocationButton color={color} onToggle={() => onToggleMarker({ lat: node.latitude, lng: node.longitude })} />
        );
      }
      return null;
    },
    [dynamicMarkerLocations, onToggleMarker]
  );

  const customizeCopy = useCallback(
    (node, nodeMeta) => {
      if (nodeMeta && nodeMeta.currentPath) {
        const path = nodeMeta.currentPath.join(".");

        if (DEFAULT_COLUMN_PATHS.includes(path)) {
          log(`Prevented adding default column: "${path}"`);
          toast.warn(`Column "${path}" is already displayed by default.`);
          return " ";
        }

        const isCurrentlyAdded = extraColumns.some((c) => c === path);
        onColumnToggle(path);

        if (isCurrentlyAdded) {
          toast.info(`Column "${path}" removed`);
        } else {
          toast.success(`Column "${path}" added`);
        }
      }
      return " ";
    },
    [extraColumns, onColumnToggle]
  );

  const customizeNode = useCallback(({ node }) => {
    if (typeof node === "object" && node !== null) {
      return { enableClipboard: false };
    }
    return { enableClipboard: true };
  }, []);

  const shouldCollapse = useCallback(({ indexOrName, depth }) => {
    if (depth === 1 && typeof indexOrName === "undefined") {
      return false;
    }
    if (depth === 2 && indexOrName === "request") {
      return false;
    }
    if (depth === 3 && ["vehicle", "trip", "deliveryvehicle", "task"].includes(indexOrName)) {
      return false;
    }
    return true;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 8px", flexShrink: 0 }}>
        <button onClick={handleCopyRoot}>Copy Object</button>
      </div>
      <div style={{ overflow: "auto", flexGrow: 1 }}>
        <JsonView
          src={featuredObject}
          collapsed={shouldCollapse}
          enableClipboard={true}
          customizeNode={customizeNode}
          customizeCopy={customizeCopy}
          CopyComponent={AddColumnButton}
          CustomOperation={CustomLocationOperation}
        />
      </div>
    </div>
  );
}

export default Dataframe;
