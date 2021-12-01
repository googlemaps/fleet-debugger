#!/bin/bash
#
# Run this script from the root directory to rebuild all
# the demos to pickup any new visualizations

rm -rf build
rm -rf demos/jump
cp datasets/jump-demo.js src/rawData.js
npm run build
cp -a build demos/jump

rm -rf build
rm -rf demos/lmfs
cp datasets/lmfs.js src/rawData.js
npm run build
cp -a build demos/lmfs

rm -rf build
rm -rf demos/multiple-trips
cp datasets/multiple-trips-sf.js src/rawData.js
npm run build
cp -a build demos/multiple-trips
