#!/bin/bash
# 
# Simple script to view a support bundle.  
# Relies on https://www.npmjs.com/package/serve
# 
if [[ -z "${APIKEY}" ]]; then
  echo "APIKEY environment variable must exist"
fi

if ! [ -x "$(command -v serve)" ]; then
  echo 'Error: serve is not installed. Install with "npm install -g serve"' >&2
  exit 1
fi

url="http://localhost:3000?apikey=$APIKEY"
echo "Attempting to open browser to $url"
open $url
serve -s 
