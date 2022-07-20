# Sample queries

This directory includes a number of sample queries encoded in runnable node scripts.  All
the sample queries output the query being run so that it can be pasted into bq, the bigquery
console or bigquery geo viz tool.

The query scripts include a detailed explanation of the query that can been seen
by passing the '--help' option.

## Dependencies

Command line queries require the [bq](https://cloud.google.com/bigquery/docs/bq-command-line-tool) bigquery 
command line tool to be installed

The visualization queries are meant to be pasted into the [BigQuery Geo Viz](https://bigquerygeoviz.appspot.com/) tool and
run from there.

The queries assume that cloud logging has been enabled and a bigquery log sink has
been [configured.](https://cloud.google.com/logging/docs/export/configure_export_v2)

## Running

Exmaple Command
```
node ./lmfs/basics/created_vehicles.js --dataset=<project id>.<dataset name>

```

### Custom options

Some queries may have custom options exposed.  Use the '--help' command to see the full set of options.

```
node ./lmfs/basics/created_vehicles.js --help
```
