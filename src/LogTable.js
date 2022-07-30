/*
 * LogTable.js
 *
 * Handles the log viewing component.
 */
import { useFilters, useSortBy, useTable } from "react-table";
import React, { useState } from "react";
import styled from "styled-components";
import _ from "lodash";

const Styles = styled.div`
  padding: 1rem;

  table {
    border-spacing: 0;
    border: 1px solid black;

    tr {
      :last-child {
        td {
          border-bottom: 0;
        }
      }
    }

    th,
    td {
      margin: 0;
      padding: 0.5rem;
      border-bottom: 1px solid black;
      border-right: 1px solid black;

      :last-child {
        border-right: 0;
      }
    }
  }

  .logtable-head {
    display: flex;
  }
  .logtable-row:hover {
    background-color: #e6e6e6;
  }
  .logtable-row.selected {
    background-color: #d0d0ff;
  }
`;

function Table({ columns, data, onSelectionChange }) {
  const [selectedRow, setSelectedRow] = useState(-1);
  const defaultColumn = React.useMemo(
    () => ({
      Filter: DefaultColumnFilter,
    }),
    []
  );

  function DefaultColumnFilter({
    column: { filterValue, preFilteredRows, setFilter },
  }) {
    const count = preFilteredRows.length;

    return (
      <input
        value={filterValue || ""}
        onChange={(e) => {
          setFilter(e.target.value || undefined);
        }}
        placeholder={`Search ${count} records...`}
      />
    );
  }

  const filterTypes = React.useMemo(
    () => ({
      text: (rows, id, filterValue) => {
        return rows.filter((row) => {
          const rowValue = row.values[id];
          return rowValue !== undefined
            ? String(rowValue)
                .toLowerCase()
                .startsWith(String(filterValue).toLowerCase())
            : true;
        });
      },
    }),
    []
  );

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable(
      {
        columns,
        data,
        defaultColumn,
        filterTypes,
        autoResetFilters: false,
        autoResetSortBy: false,
      },
      useFilters,
      useSortBy
    );

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => (
              <th {...column.getHeaderProps()}>
                <div
                  className="logtable-head"
                  {...column.getSortByToggleProps()}
                >
                  {column.render("Header")}
                  <div style={{ width: 20 }}>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? " 🔽"
                        : " 🔼"
                      : ""}
                  </div>
                </div>
                <div>{column.canFilter ? column.render("Filter") : null}</div>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody {...getTableBodyProps()}>
        {rows.map((row) => {
          prepareRow(row);
          return (
            <tr
              {...row.getRowProps()}
              className={`logtable-row ${
                selectedRow === row.index ? "selected" : ""
              }`}
              onClick={() => {
                setSelectedRow(row.index);
                onSelectionChange(row.original);
              }}
            >
              {row.cells.map((cell) => {
                return <td {...cell.getCellProps()}>{cell.render("Cell")}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/*
 * Helper method for removing common substrings in cells.  Typically
 * used for removing a prefix from ENUMs.
 */
const TrimCell = ({ value, trim }) => {
  return <>{value && value.replace(trim, "")}</>;
};

function LogTable(props) {
  const minTime = props.timeRange.minTime;
  const maxTime = props.timeRange.maxTime;
  const data = props.logData.tripLogs
    .getLogs_(new Date(minTime), new Date(maxTime))
    .value();

  const columns = React.useMemo(() => {
    const stdColumns = _.filter(
      [
        {
          Header: "Date",
          accessor: "formattedDate",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "SDK Version",
          accessor: "request.header.sdkversion",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "OS Version",
          accessor: "request.header.osversion",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Method",
          accessor: "@type",
          Cell: ({ cell: { value } }) => (
            <TrimCell
              value={value}
              trim="type.googleapis.com/maps.fleetengine."
            />
          ),
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Vehicle",
          accessor: (entry) => {
            const name = _.get(entry, "response.name");
            if (name) {
              const match = name.match(/vehicles\/(.*)/);
              if (match) {
                return match[1];
              }
            }
          },
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Vehicle",
          accessor: (entry) => {
            const name = _.get(entry, "response.name");
            if (name) {
              const match = name.match(/deliveryVehicles\/(.*)/);
              if (match) {
                return match[1];
              }
            }
          },
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Trip",
          accessor: (entry) => {
            const currentTrips = _.get(entry, "response.currenttrips");
            if (currentTrips) {
              return currentTrips[0];
            }
          },
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Vehicle State",
          accessor: "response.vehiclestate",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="VEHICLE_STATE_" />
          ),
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Task State",
          accessor: "response.state",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="TASK_STATE_" />
          ),
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Trip Status",
          accessor: "response.tripstatus",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="TRIP_STATUS_" />
          ),
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Remaining tasks",
          id: "reamining_tasks",
          accessor: "response.remainingvehiclejourneysegments",
          Cell: ({ cell: { value } }) => (
            <>{value && _.sumBy(value, "stop.tasks.length")}</>
          ),
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Remaining Distance This Segment",
          accessor: "request.deliveryvehicle.remainingdistancemeters",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Remaining Segements",
          accessor: "response.remainingvehiclejourneysegments",
          Cell: ({ cell: { value } }) => <>{value && value.length}</>,
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Nav Status",
          // XXX request or response best?
          accessor: "navStatus",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="NAVIGATION_STATUS_" />
          ),
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
        accessor: dotPath,
      });
    });
    const headers = [
      {
        Header: "Log Entries (click row to view full log entry)",
        columns: stdColumns,
      },
    ];
    return headers;
  }, [props.extraColumns]);

  return (
    <Styles>
      <Table
        columns={columns}
        data={data}
        onSelectionChange={props.onSelectionChange}
      />
    </Styles>
  );
}

export { LogTable as default };
