// src/LogTable.js

import React, { useState } from "react";
import { useSortBy, useTable } from "react-table";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import _ from "lodash";

function Table({ columns, data, onSelectionChange, listRef, selectedRow, centerOnLocation }) {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(
    {
      columns,
      data,
      autoResetSortBy: false,
    },
    useSortBy
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

      return (
        <div
          {...row.getRowProps({
            style: {
              ...style,
              pointerEvents: "auto",
              color: hasError ? "darkred" : "inherit",
            },
          })}
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
          {row.cells.map((cell) => (
            <div
              {...cell.getCellProps()}
              className={`logtable-cell ${cell.column.className || ""}`}
              style={{ width: cell.column.width }}
            >
              {cell.render("Cell")}
            </div>
          ))}
        </div>
      );
    },
    [prepareRow, rows, selectedRow, handleRowSelection, centerOnLocation]
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
          <div>
            <div {...getTableProps()}>
              <div>
                {headerGroups.map((headerGroup) => (
                  <div {...headerGroup.getHeaderGroupProps()} className="logtable-header-row">
                    {headerGroup.headers.map((column) => (
                      <div
                        {...column.getHeaderProps()}
                        className={`logtable-header-cell ${column.className || ""}`}
                        style={{ width: column.width }}
                      >
                        {column.render("Header")}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div {...getTableBodyProps()}>
                <List
                  ref={listRef}
                  height={height - 100}
                  itemCount={rows.length}
                  itemSize={35}
                  width={width}
                  overscanCount={10}
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
  const data = props.logData.tripLogs.getLogs_(new Date(minTime), new Date(maxTime)).value();
  const columnShortWidth = 50;
  const columnRegularWidth = 120;
  const columnLargeWidth = 150;
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
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="type.googleapis.com/maps.fleetengine." />,
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
          maxWidth: columnShortWidth,
          className: "logtable-cell short-column",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Sensor",
          accessor: "lastlocation.rawlocationsensor",
          id: "lastlocation_rawlocationsensor",
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="LOCATION_SENSOR_" />,
          width: columnShortWidth,
          maxWidth: columnShortWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Location",
          accessor: "lastlocation.locationsensor",
          id: "lastlocation_locationsensor",
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="_LOCATION_PROVIDER" />,
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "TripId 7",
          accessor: (entry) => {
            const currentTrips = _.get(entry, "response.currenttrips");
            if (currentTrips && currentTrips[0]) {
              const tripId = currentTrips[0];
              return tripId.substring(Math.max(0, tripId.length - 7));
            }
            return null;
          },
          width: columnShortWidth,
          maxWidth: columnShortWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Vehicle State",
          accessor: "response.vehiclestate",
          id: "response_vehiclestate",
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="VEHICLE_STATE_" />,
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Task State",
          accessor: "response.state",
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="TASK_STATE_" />,
          width: columnRegularWidth,
          className: "logtable-cell",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Trip Status",
          accessor: "response.tripstatus",
          id: "response_tripstatus",
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="TRIP_STATUS_" />,
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
          Cell: ({ cell: { value } }) => <TrimCell value={value} trim="NAVIGATION_STATUS_" />,
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
        width: columnRegularWidth,
        className: "logtable-cell",
      });
    });
    const headers = [
      {
        Header: "Event Logs Table (click row to view full log entry and long click to also center map)",
        columns: stdColumns,
      },
    ];
    return headers;
  }, [props.extraColumns, props.logData.solutionType]);

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

// Helper method for removing common substrings in cells
const TrimCell = ({ value, trim }) => {
  return <>{value && value.replace(trim, "")}</>;
};

export default React.forwardRef((props, ref) => <LogTable {...props} ref={ref} />);
