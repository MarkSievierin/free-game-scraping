require("dotenv").config();

const { runFreeGames } = require("./src/application/run-free-games");

runFreeGames().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exitCode = 1;
});
