// src/LogTable.js
import React, { useState } from "react";
import { useSortBy, useTable, useBlockLayout, useResizeColumns } from "react-table";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import _ from "lodash";

const TableStateContext = React.createContext(null);

const SparkleIcon = ({ active }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill={active ? "#007a87" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      color: active ? "#007a87" : "#888",
      opacity: active ? 1.0 : 0.4,
      transition: "all 0.2s ease",
    }}
    className="simplify-icon"
  >
    <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z" />
  </svg>
);

export function getTooltipText(category, state) {
  if (category === "timestamp") {
    const states = ["Original Timestamp", "Month-Day Time (MM-DD HH:MM:SS)"];
    const nextState = states[(state + 1) % 2];
    return `Format: ${states[state]}\nClick to change to: ${nextState}`;
  }
  if (category === "duration") {
    const states = ["Original Seconds", "Clock Time ETA (MM-DD HH:MM:SS)", "Friendly Duration (Xm Ys)"];
    const nextState = states[(state + 1) % 3];
    return `Format: ${states[state]}\nClick to change to: ${nextState}`;
  }
  if (category === "distance") {
    const states = ["Original Meters", "Kilometers (km)", "Miles (mi)"];
    const nextState = states[(state + 1) % 3];
    return `Format: ${states[state]}\nClick to change to: ${nextState}`;
  }
  return "";
}

export function parseTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  let target = val;
  if (typeof val === "string") {
    const cleanVal = val.trim();
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(cleanVal) &&
      !cleanVal.endsWith("Z") &&
      !/[+-]\d{2}:?\d{2}$/.test(cleanVal)
    ) {
      target = cleanVal + "Z";
    } else {
      target = cleanVal;
    }
  }
  const parsed = Date.parse(target);
  return isNaN(parsed) ? null : new Date(parsed);
}

export function formatDateAndTime(date) {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function formatFriendlyDuration(durationSeconds) {
  const absSeconds = Math.abs(durationSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = Math.round(absSeconds % 60);

  if (minutes === 0) {
    return `${durationSeconds < 0 ? "-" : ""}${seconds}s`;
  }
  return `${durationSeconds < 0 ? "-" : ""}${minutes}m ${seconds}s`;
}

export function getBaseTimeForDuration(rowData, path) {
  if (typeof path === "string" && path.startsWith("request")) {
    const pathParts = path.split(".");
    if (pathParts.length >= 2) {
      const prefix = pathParts.slice(0, 2).join(".");
      const candidatePaths = [`${prefix}.lastlocation.updatetime`, `${prefix}.lastlocation.rawlocationtime`];
      for (const p of candidatePaths) {
        const val = _.get(rowData, p);
        const parsed = parseTimestamp(val);
        if (parsed) return parsed;
      }
    }
  }

  const genericVal = rowData.formattedDate || rowData.timestamp;
  if (genericVal) {
    const parsed = parseTimestamp(genericVal);
    if (parsed) return parsed;
  }

  return null;
}

export function formatValue(value, category, state, rowData, columnId) {
  if (category === "timestamp") {
    const date = parseTimestamp(value);
    if (!date) return String(value);

    switch (state) {
      case 1:
        return formatDateAndTime(date);
      default:
        return String(value);
    }
  }

  if (category === "duration") {
    const durationSeconds = Number(value);
    if (isNaN(durationSeconds)) return String(value);

    switch (state) {
      case 1: {
        const baseDate = getBaseTimeForDuration(rowData, columnId);
        if (!baseDate) return String(value);
        const targetDate = new Date(baseDate.getTime() + durationSeconds * 1000);
        return formatDateAndTime(targetDate);
      }
      case 2:
        return formatFriendlyDuration(durationSeconds);
      default:
        return String(value);
    }
  }

  if (category === "distance") {
    const meters = Number(value);
    if (isNaN(meters)) return String(value);

    switch (state) {
      case 1:
        return `${(meters / 1000).toFixed(2)} km`;
      case 2:
        return `${(meters * 0.000621371).toFixed(2)} mi`;
      default:
        return String(value);
    }
  }

  return String(value);
}

export function getColumnCategory(columnId, sampleValue) {
  if (columnId === undefined || columnId === null) return null;
  const idLower = String(columnId).toLowerCase();

  if (columnId === "formattedDate" || idLower === "daytime") {
    return null;
  }

  if (
    idLower.includes("time") ||
    idLower.includes("timestamp") ||
    idLower.includes("version") ||
    idLower.includes("date") ||
    (typeof sampleValue === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(sampleValue))
  ) {
    if (typeof sampleValue === "string" && !isNaN(Date.parse(sampleValue))) {
      return "timestamp";
    }
  }

  const isNumeric = sampleValue !== null && sampleValue !== undefined && !isNaN(Number(sampleValue));
  if (isNumeric) {
    if (idLower.includes("seconds") || idLower.includes("duration") || idLower.includes("remainingtime")) {
      return "duration";
    }
    if (idLower.includes("meters") || idLower.includes("distance")) {
      return "distance";
    }
  }

  return null;
}

const CellWrapper = ({ originalCell, cellProps, columnId, category }) => {
  const context = React.useContext(TableStateContext);
  if (!context) {
    if (originalCell) return React.createElement(originalCell, cellProps);
    return <>{cellProps.value !== undefined && cellProps.value !== null ? String(cellProps.value) : ""}</>;
  }

  const { columnFormats } = context;
  const activeFormat = columnId in columnFormats ? columnFormats[columnId] : category ? 1 : 0;

  if (activeFormat === 0 || !category) {
    if (originalCell) return React.createElement(originalCell, cellProps);
    const val = cellProps.value;
    return <>{val !== undefined && val !== null ? String(val) : ""}</>;
  }

  const rawValue = cellProps.value;
  if (rawValue === undefined || rawValue === null) return null;

  const formattedValue = formatValue(rawValue, category, activeFormat, cellProps.row.original, columnId);

  return (
    <span className="simplified-value" title={`Raw: ${rawValue}`}>
      {formattedValue}
    </span>
  );
};

const HeaderCellWrapper = ({ column, restColumnProps }) => {
  const { columnFormats, toggleColumnFormat } = React.useContext(TableStateContext);
  const columnId = column.id || (typeof column.accessor === "string" ? column.accessor : column.Header);
  const activeFormat = columnId in columnFormats ? columnFormats[columnId] : column.category ? 1 : 0;

  return (
    <div
      {...restColumnProps}
      className={`logtable-header-cell ${column.className || ""}`}
      style={{ ...restColumnProps.style, position: "relative" }}
    >
      <div className="logtable-header-inner">
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {column.render("Header")}
        </span>
        {column.category && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleColumnFormat(columnId, column.category);
            }}
            title={getTooltipText(column.category, activeFormat)}
            className="simplify-button-container"
          >
            <SparkleIcon active={activeFormat > 0} />
          </div>
        )}
      </div>
      <div
        {...column.getResizerProps()}
        className={`resizer ${column.isResizing ? "isResizing" : ""}`}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

const CELL_PADDING = 24;

function getDisplayText(col, entry) {
  const raw = typeof col.accessor === "function" ? col.accessor(entry) : _.get(entry, col.accessor);
  if (raw === undefined || raw === null) return "";
  const str = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
  if (col.trim) return str.replace(col.trim, "");
  return str;
}

function computeColumnWidths(columns, data) {
  const sampleSize = Math.min(data.length, 200);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = "16px Times-Roman";

  columns.forEach((col) => {
    const headerStr = col.Header || "";
    let maxWidthPx = context.measureText(headerStr).width;

    for (let i = 0; i < sampleSize; i++) {
      const text = getDisplayText(col, data[i]);
      if (text) {
        const textWidth = context.measureText(text).width;
        if (textWidth > maxWidthPx) maxWidthPx = textWidth;
      }
    }
    const fitted = Math.ceil(maxWidthPx + CELL_PADDING);
    col.width = Math.min(fitted, col.width);
  });
}

function Table({
  columns,
  data,
  onSelectionChange,
  listRef,
  selectedRow,
  centerOnLocation,
  columnFormats,
  toggleColumnFormat,
}) {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow, totalColumnsWidth } = useTable(
    {
      columns,
      data,
      autoResetSortBy: false,
    },
    useBlockLayout,
    useSortBy,
    useResizeColumns
  );

  const handleRowSelection = React.useCallback(
    (index, rowData) => {
      onSelectionChange(index, rowData);
    },
    [onSelectionChange]
  );

  const Row = React.useCallback(
    ({ index, style }) => {
      const row = rows[index];
      prepareRow(row);

      const [pressTimer, setPressTimer] = React.useState(null);
      const [isLongPress, setIsLongPress] = React.useState(false);
      const hasError = !!row.original.error;

      const startPressTimer = () => {
        setIsLongPress(false);
        const timer = setTimeout(() => {
          setIsLongPress(true);
          handleLongPress();
        }, 350);
        setPressTimer(timer);
      };

      const cancelPressTimer = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          setPressTimer(null);
        }
      };

      const handleLongPress = () => {
        const lat = _.get(row.original, "lastlocationResponse.rawlocation.latitude");
        const lng = _.get(row.original, "lastlocationResponse.rawlocation.longitude");
        if (lat && lng && centerOnLocation) {
          console.log("Calling centerOnLocation due to long press with:", lat, lng);
          centerOnLocation(lat, lng);
        } else {
          console.log("Unable to center: Invalid coordinates or centerOnLocation not available");
        }
      };

      const { key, ...restRowProps } = row.getRowProps({
        style: {
          ...style,
          pointerEvents: "auto",
          color: hasError ? "darkred" : "inherit",
        },
      });

      return (
        <div
          key={key}
          {...restRowProps}
          className={`logtable-row ${selectedRow === index ? "selected" : ""}`}
          onMouseDown={startPressTimer}
          onMouseUp={() => {
            cancelPressTimer();
            if (!isLongPress) {
              handleRowSelection(index, row.original);
            }
          }}
          onMouseLeave={cancelPressTimer}
          onTouchStart={startPressTimer}
          onTouchEnd={() => {
            cancelPressTimer();
            if (!isLongPress) {
              handleRowSelection(index, row.original);
            }
          }}
        >
          {row.cells.map((cell) => {
            const { key, ...restCellProps } = cell.getCellProps();
            return (
              <div
                key={key}
                {...restCellProps}
                className={`logtable-cell ${cell.column.className || ""}`}
                style={restCellProps.style}
              >
                {cell.render("Cell")}
              </div>
            );
          })}
        </div>
      );
    },
    [prepareRow, rows, selectedRow, handleRowSelection, centerOnLocation, totalColumnsWidth]
  );

  return (
    <TableStateContext.Provider value={{ columnFormats, toggleColumnFormat }}>
      <div
        style={{
          height: "calc(100% - 1px)",
          width: "calc(100% - 1px)",
          overflow: "hidden",
        }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <div style={{ width, overflowX: "auto", overflowY: "hidden" }}>
              <div {...getTableProps()} style={{ minWidth: "100%", width: totalColumnsWidth }}>
                <div>
                  {headerGroups.map((headerGroup) => {
                    const { key, ...restHeaderGroupProps } = headerGroup.getHeaderGroupProps();
                    return (
                      <div key={key} {...restHeaderGroupProps} className="logtable-header-row">
                        {headerGroup.headers.map((column) => {
                          const { key, ...restColumnProps } = column.getHeaderProps();
                          return <HeaderCellWrapper key={key} column={column} restColumnProps={restColumnProps} />;
                        })}
                      </div>
                    );
                  })}
                </div>
                <div {...getTableBodyProps()}>
                  <List
                    ref={listRef}
                    height={height - 54}
                    itemCount={rows.length}
                    itemSize={32}
                    width={totalColumnsWidth > width ? totalColumnsWidth : width}
                    overscanCount={10}
                    itemData={totalColumnsWidth}
                    style={{ overflowX: "hidden" }}
                  >
                    {Row}
                  </List>
                </div>
              </div>
            </div>
          )}
        </AutoSizer>
      </div>
    </TableStateContext.Provider>
  );
}

function LogTable(props) {
  const listRef = React.useRef(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [columnFormats, setColumnFormats] = useState({});

  const toggleColumnFormat = React.useCallback((columnId, category) => {
    setColumnFormats((prev) => {
      const current = columnId in prev ? prev[columnId] : category ? 1 : 0;
      const maxStates = category === "timestamp" ? 2 : category === "duration" ? 3 : category === "distance" ? 3 : 1;
      const next = (current + 1) % maxStates;
      return {
        ...prev,
        [columnId]: next,
      };
    });
  }, []);

  const minTime = props.timeRange.minTime;
  const maxTime = props.timeRange.maxTime;
  const data = React.useMemo(() => {
    return props.logData.tripLogs.getLogs_(new Date(minTime), new Date(maxTime), props.filters).value();
  }, [props.logData.tripLogs, minTime, maxTime, props.filters]);
  const columnShortWidth = 100;
  const columnRegularWidth = 130;
  const columnLargeWidth = 190;
  const columns = React.useMemo(() => {
    const stdColumns = _.filter(
      [
        {
          Header: "DayTime",
          accessor: "formattedDate",
          Cell: ({ cell: { value } }) => value.substring(5, 10) + " " + value.substring(11, 19),
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Method",
          accessor: "@type",
          Cell: TrimCellRenderer,
          trim: "type.googleapis.com/maps.fleetengine.",
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Kmph",
          accessor: (entry) => {
            const speed = _.get(entry, "lastlocation.speed");
            if (speed) {
              return Math.round(speed * 3.6);
            }
          },
          width: columnShortWidth,
          className: "logtable-cell short-column",
          solutionTypes: ["ODRD", "LMFS"],
        },

        {
          Header: "Sensor",
          accessor: "lastlocation.rawlocationsensor",
          id: "lastlocation_rawlocationsensor",
          Cell: TrimCellRenderer,
          trim: "LOCATION_SENSOR_",
          width: columnShortWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Location",
          accessor: "lastlocationResponse.locationsensor",
          id: "lastlocationResponse_locationsensor",
          Cell: TrimCellRenderer,
          trim: "_LOCATION_PROVIDER",
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "CurrentTrip12",
          accessor: (entry) => {
            const currentTrips = _.get(entry, "response.currenttrips");
            if (currentTrips && currentTrips[0]) {
              const tripId = currentTrips[0];
              return tripId.substring(Math.max(0, tripId.length - 12));
            }
            return null;
          },
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Vehicle State",
          accessor: "response.vehiclestate",
          id: "response_vehiclestate",
          Cell: TrimCellRenderer,
          trim: "VEHICLE_STATE_",
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Task State",
          accessor: "response.state",
          Cell: TrimCellRenderer,
          trim: "TASK_STATE_",
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Trip Status",
          accessor: "response.tripstatus",
          id: "response_tripstatus",
          Cell: TrimCellRenderer,
          trim: "TRIP_STATUS_",
          width: columnLargeWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Remaining tasks",
          id: "reamining_tasks",
          accessor: "response.remainingvehiclejourneysegments",
          Cell: ({ cell: { value } }) => <>{value && _.sumBy(value, "stop.tasks.length")}</>,
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Remaining Distance This Segment",
          accessor: "request.deliveryvehicle.remainingdistancemeters",
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Remaining Segements",
          accessor: "response.remainingvehiclejourneysegments",
          Cell: ({ cell: { value } }) => <>{value && value.length}</>,
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Nav Status",
          accessor: "navStatus",
          Cell: TrimCellRenderer,
          trim: "NAVIGATION_STATUS_",
          width: columnLargeWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
      ],
      (column) => {
        return column.solutionTypes.indexOf(props.logData.solutionType) !== -1;
      }
    );
    // Add dynamic columns
    _.map(props.extraColumns, (dotPath) => {
      const elems = dotPath.split(".");

      let columnClass = "logtable-cell";
      if (dotPath.startsWith("response.")) {
        columnClass += " response-column";
      }

      stdColumns.push({
        Header: elems[elems.length - 1],
        accessor: dotPath === ".error" ? "error" : dotPath,
        width: columnLargeWidth,
        className: columnClass,
        Cell: ({ cell }) => {
          const value = cell.value;
          if (value === undefined || value === null) return null;
          return typeof value === "boolean" ? String(value) : value;
        },
      });
    });
    const processedColumns = stdColumns.map((col) => {
      const columnId = col.id || (typeof col.accessor === "string" ? col.accessor : col.Header);

      // Find a sample value to detect the category
      const sampleRow = data.find((row) => {
        const val = typeof col.accessor === "function" ? col.accessor(row) : _.get(row, col.accessor);
        return val !== null && val !== undefined;
      });
      const sampleValue = sampleRow
        ? typeof col.accessor === "function"
          ? col.accessor(sampleRow)
          : _.get(sampleRow, col.accessor)
        : null;

      const category = getColumnCategory(columnId, sampleValue);
      const originalCell = col.Cell;

      return {
        ...col,
        id: columnId,
        category,
        Cell: (cellProps) => (
          <CellWrapper originalCell={originalCell} cellProps={cellProps} columnId={columnId} category={category} />
        ),
      };
    });

    computeColumnWidths(processedColumns, data);
    return processedColumns;
  }, [props.extraColumns, props.logData.solutionType, data]);

  const handleRowSelection = React.useCallback(
    (rowIndex, rowData) => {
      setSelectedRowIndex(rowIndex);
      props.onSelectionChange(rowData, rowIndex);
    },
    [props.onSelectionChange]
  );

  const focusOnRow = React.useCallback(
    (rowData) => {
      if (rowData && listRef.current) {
        const rowIndex = data.findIndex((row) => {
          if (row.idx !== undefined && rowData.idx !== undefined) {
            return row.idx === rowData.idx;
          }
          return row.timestamp === rowData.timestamp;
        });
        if (rowIndex !== -1) {
          listRef.current.scrollToItem(rowIndex, "center");
          setSelectedRowIndex(rowIndex);
          handleRowSelection(rowIndex, rowData);
        }
      }
    },
    [data, handleRowSelection]
  );

  React.useEffect(() => {
    if (props.setFocusOnRowFunction) {
      props.setFocusOnRowFunction(focusOnRow);
    }
  }, [focusOnRow, props.setFocusOnRowFunction]);

  return (
    <Table
      columns={columns}
      data={data}
      onSelectionChange={handleRowSelection}
      selectedRow={selectedRowIndex}
      disableResizing={true}
      listRef={listRef}
      centerOnLocation={props.centerOnLocation}
      columnFormats={columnFormats}
      toggleColumnFormat={toggleColumnFormat}
    />
  );
}

const TrimCellRenderer = ({ cell }) => {
  const { value } = cell;
  const trim = cell.column.trim;
  return <>{value && value.replace(trim, "")}</>;
};

export default React.forwardRef((props, ref) => <LogTable {...props} ref={ref} />);
