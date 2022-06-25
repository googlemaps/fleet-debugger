# Fleet Debugger Cloud Run Example

This demonstrates how fleet-debugger could be deployed via cloud run.  Cloud run
service accounts will need to be configured to allow access to the datastore for
logs (ie cloud logging or bigquery).

The endpoints exposed are not authenticated and will need to be protected by something
like Cloud Identity Aware Proxy.

## Deploying

```
./deploy.sh
```
