/*
 * LogTable.js
 *
 * Handles the log viewing component.
 */
import { useTable } from "react-table";
import React from "react";
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
`;

function Table({ columns, data, onSelectionChange }) {
  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({
      columns,
      data,
    });

  return (
    <table {...getTableProps()}>
      <thead>
        {headerGroups.map((headerGroup) => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map((column) => (
              <th {...column.getHeaderProps()}>{column.render("Header")}</th>
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
              onClick={() => onSelectionChange(row.original)}
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
          accessor: "jsonpayload.request.header.sdkversion",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "OS Version",
          accessor: "jsonpayload.request.header.osversion",
          solutionTypes: ["ODRD", "LMFS"],
        },
        {
          Header: "Method",
          accessor: "jsonpayload.@type",
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
          accessor: "labels.vehicle_id",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Vehicle",
          accessor: "labels.delivery_vehicle_id",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Trip",
          accessor: "labels.trip_id",
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Vehicle State",
          accessor: "jsonpayload.response.state",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="VEHICLE_STATE_" />
          ),
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Task State",
          accessor: "jsonpayload.response.state",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="TASK_STATE_" />
          ),
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Trip Status",
          accessor: "jsonpayload.response.status",
          Cell: ({ cell: { value } }) => (
            <TrimCell value={value} trim="TRIP_STATUS_" />
          ),
          solutionTypes: ["ODRD"],
        },
        {
          Header: "Remaining tasks",
          id: "reamining_tasks",
          accessor: "jsonpayload.response.remainingvehiclejourneysegments",
          Cell: ({ cell: { value } }) => (
            <>{value && _.sumBy(value, "stop.tasks.length")}</>
          ),
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Remaining Distance This Segment",
          accessor:
            "jsonpayload.request.deliveryvehicle.remainingdistancemeters",
          solutionTypes: ["LMFS"],
        },
        {
          Header: "Remaining Segements",
          accessor: "jsonpayload.response.remainingvehiclejourneysegments",
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
