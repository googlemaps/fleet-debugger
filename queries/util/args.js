const process = require("process");
exports.processArgs = function (desc, opts) {
  opts.dataset = {
    describe: "full <project>.<dataset name> dataset path",
    default: process.env["FD_DATASET"],
    required: true,
  };
  return require("yargs/yargs")(process.argv.slice(2)).usage(desc).options(opts)
    .argv;
};
