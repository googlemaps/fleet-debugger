#!/bin/bash
rm -rf ./fleet-debugger
mkdir fleet-debugger
(cd .. && npm run build)
cp -a ../build fleet-debugger
cp -a ../dune-buggy.js ./fleet-debugger/index.js
cp -a ../components ./fleet-debugger/
cp package.json ./fleet-debugger
cp app.yaml ./fleet-debugger
cp fleet-debugger.sh ./fleet-debugger/
echo env_variables: >> ./fleet-debugger/app.yaml
echo "   APIKEY: \"$APIKEY\"" >> ./fleet-debugger/app.yaml
(cd ./fleet-debugger && gcloud app deploy)
