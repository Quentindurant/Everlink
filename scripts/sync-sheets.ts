import { runSheetsSync } from "../lib/sync/runSheetsSync";

runSheetsSync("CLI")
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.succes ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
