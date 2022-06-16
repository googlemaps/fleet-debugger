# Generating Bundle
To generate a support bundle for reporting issues with either debugger or the full ODRD/LMFS solution run the following commands:

```
# Generate data files for reporting issues
dune-buggy.js historical --apikey nokey  --vehicle=my-vehicle-id
# build sharable, static artifact.  Any webserver should be able to host this.
npm run build
tar -czf support-dump.tgz build
```

The generated support-dump.tgz file can be included in bug reports & communication with support.

# Viewing Bundle

The view-bundle.sh script starts a simple webserver and attempts to open a browser window with the
correct url (including specifying a valid API key).

```
tar -xzf support-dump.tgz
cd build
./view-bundle.sh
```

Note that any simple http server can be used to serve the index.html file in the build directior.  The following
would suffice:
```
python3 -m http.server
```

# Viewing bundle with newer version of the debugger

The data used in the debugger is contained within the data.json file.  This file can be copied
out of support bundle and placed in the 'public' directory of a fleet-debugger github repo.
Once copied, 'npm start' in the fleet-debugger repo will let this bundle be viewed with the
newer UI.
