require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  all,
  close,
  ensureDirectoryForFile,
  openDatabase,
  resolveDatabasePath,
  run,
} = require("../src/services/storage/sqlite.utils");

const MIGRATIONS_DIRECTORY = path.resolve(__dirname, "..", "migrations");

async function ensureMigrationsTable(database) {
  await run(
    database,
    `CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );
}

function loadMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => ({
      name: fileName,
      sql: fs.readFileSync(path.join(MIGRATIONS_DIRECTORY, fileName), "utf8"),
    }));
}

async function getAppliedMigrationNames(database) {
  const rows = await all(database, "SELECT name FROM migrations ORDER BY id ASC");
  return new Set(rows.map((row) => String(row.name || "").trim()));
}

async function applyMigration(database, migration) {
  await run(database, "BEGIN");

  try {
    await run(database, migration.sql);
    await run(database, "INSERT INTO migrations (name) VALUES (?)", [migration.name]);
    await run(database, "COMMIT");
  } catch (error) {
    await run(database, "ROLLBACK").catch(() => {});
    throw error;
  }
}

async function main() {
  const databasePath = resolveDatabasePath();
  ensureDirectoryForFile(databasePath);
  const database = await openDatabase(databasePath);

  try {
    await ensureMigrationsTable(database);
    const appliedMigrationNames = await getAppliedMigrationNames(database);
    const migrations = loadMigrationFiles();

    for (const migration of migrations) {
      if (appliedMigrationNames.has(migration.name)) {
        continue;
      }

      await applyMigration(database, migration);
      console.log(`Applied migration: ${migration.name}`);
    }

    console.log(`Database is ready: ${databasePath}`);
  } finally {
    await close(database);
  }
}

main().catch((error) => {
  console.error(`Database setup failed: ${error.message}`);
  process.exitCode = 1;
});
