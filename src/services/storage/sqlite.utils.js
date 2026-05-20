const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");

const DEFAULT_DATABASE_PATH = path.resolve(process.cwd(), "data", "free-games.sqlite");

function resolveDatabasePath() {
  const customPath = String(process.env.SQLITE_PATH || "").trim();
  return customPath ? path.resolve(process.cwd(), customPath) : DEFAULT_DATABASE_PATH;
}

function ensureDirectoryForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function openDatabase(filePath) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filePath, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(database);
    });
  });
}

function run(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function close(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

module.exports = {
  all,
  close,
  DEFAULT_DATABASE_PATH,
  ensureDirectoryForFile,
  get,
  openDatabase,
  resolveDatabasePath,
  run,
};
