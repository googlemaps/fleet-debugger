/*
 * Start up simple serve to handle requests for logs
 */
function Serve(port, getLogs, dataSource, params) {
  const express = require("express");
  const app = express();

  // Server up static debugger page
  app.use("/debugger", express.static("build"));

  app.get("/", (req, res) => {
    res.redirect("/debugger/?serve=true");
  });

  app.get("/vehicles/*", async (req, res) => {
    const vehicle = req.path.slice(10);
    console.log("Got vehicle request", vehicle);

    await getLogs(dataSource, params, vehicle, undefined);
    res.json(params);
  });

  app.get("/trips/*", async (req, res) => {
    const trip = req.path.slice(7);
    console.log("Got trip request", trip);
    await getLogs(dataSource, params, undefined, trip);
    res.json(params);
  });

  app.listen(port, () => {
    console.log(`fleet-debugger: listening on port ${port}`);
  });
}

exports.Serve = Serve;
