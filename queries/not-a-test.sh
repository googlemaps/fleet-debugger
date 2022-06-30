#!/bin/bash
#
# Once we have a real, published test this can be made into
# a real test.  For now, at least verify all of the commands work.
#
# usage ./not-a-test.sh <project id>.<dataset name>

dataset="$1"
if [ -z "$dataset" ]; then
   echo "Must specify dataset as <project id>.<dataset name>"
   exit 1
fi

./lmfs/basics/active_tasks.js --dataset=$dataset || exit 1
./lmfs/basics/active_vehicles.js --dataset=$dataset || exit 1
./lmfs/basics/created_tasks.js --dataset=$dataset || exit 1
./lmfs/basics/task_outcomes.js --dataset=$dataset || exit 1
./lmfs/basics/created_vehicles.js --dataset=$dataset || exit 1
./lmfs/movement/fleet-distance-traveled.js --dataset=$dataset --date=2022-06-03|| exit 1
./lmfs/movement/vehicle-speeds.js --dataset=$dataset || exit 1
./lmfs/movement/vehicle-distance-traveled.js --dataset=$dataset --date=2022-06-03 --vehicle=protesting_elephant_1654199548000|| exit 1
./lmfs/deviations/offroute_fraction_per_vehicle.js --dataset=$dataset || exit 1
./lmfs/location_reliability/magic_numbers.js --dataset=$dataset || exit 1

echo "*********************************"
echo "* All not actually tests passed *"
echo "*********************************"
