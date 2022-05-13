#!/bin/bash
rm -rf ./fleet-debugger
mkdir fleet-debugger
(cd .. && npm run build)
cp -a ../build fleet-debugger
cp -a ../dune-buggy.js ./fleet-debugger/index.js
cp -a ../components ./fleet-debugger/
cp package.json ./fleet-debugger
cp fleet-debugger.sh ./fleet-debugger/
(cd ./fleet-debugger && gcloud run deploy --update-env-vars APIKEY=$APIKEY)
