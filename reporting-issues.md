To generate a support bundle for reporting issues with either debugger or the full ODRD/LMFS solution run the following commands:

```
# Generate data files for reporting issues
dune-buggy.js historical --apikey nokey  --vehicle=my-vehicle-id
# build sharable, static artifact.  Any webserver should be able to host this.
npm run build
tar -czf support-dump.tgz build
```

The generated support-dump.tgz file can be included in bug reports & communication with support.
