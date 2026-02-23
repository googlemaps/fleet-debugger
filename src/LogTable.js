// src/LogTable.js
import React, { useState } from "react";
import { useSortBy, useTable, useBlockLayout, useResizeColumns } from "react-table";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import _ from "lodash";

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

function Table({ columns, data, onSelectionChange, listRef, selectedRow, centerOnLocation }) {
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
                        return (
                          <div
                            key={key}
                            {...restColumnProps}
                            className={`logtable-header-cell ${column.className || ""}`}
                            style={{ ...restColumnProps.style, position: "relative" }}
                          >
                            {column.render("Header")}
                            <div
                              {...column.getResizerProps()}
                              className={`resizer ${column.isResizing ? "isResizing" : ""}`}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        );
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
  );
}

function LogTable(props) {
  const listRef = React.useRef(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
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
          accessor: "lastlocation.locationsensor",
          id: "lastlocation_locationsensor",
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
      stdColumns.push({
        Header: elems[elems.length - 1],
        accessor: dotPath === ".error" ? "error" : dotPath,
        width: columnLargeWidth,
        className: "logtable-cell",
        Cell: ({ cell }) => {
          const value = cell.value;
          if (value === undefined || value === null) return null;
          return typeof value === "boolean" ? String(value) : value;
        },
      });
    });
    computeColumnWidths(stdColumns, data);
    return stdColumns;
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
        const rowIndex = data.findIndex((row) => row.timestamp === rowData.timestamp);
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
    />
  );
}

const TrimCellRenderer = ({ cell }) => {
  const { value } = cell;
  const trim = cell.column.trim;
  return <>{value && value.replace(trim, "")}</>;
};

export default React.forwardRef((props, ref) => <LogTable {...props} ref={ref} />);
