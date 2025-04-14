const { exec } = require("child_process");
exports.query = function query(query) {
  const cmd = `bq query --nouse_legacy_sql '${query}'`;
  console.log(`Running bq command\n ${cmd}`);
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.log(`error:\n${error.message}`);
      console.log(`stderr:\n${stderr}`);
      process.exit(1);
      return 1;
    }
    if (stderr) {
      console.log(`stderr:\n${stderr}`);
      process.exit(1);
      return 1;
    }
    console.log(`Result:\n${stdout}`);
    return 0;
  });
};
