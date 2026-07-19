// Applies pending SQL migrations from ./drizzle. Runs as the Railway pre-deploy
// command (node dist/db/migrate.js) — programmatic so the production image only
// needs runtime deps, not drizzle-kit.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/db/ (or src/db/ under tsx) → ../../drizzle at the package root.
const migrationsFolder = path.resolve(here, "../../drizzle");

try {
  await migrate(db, { migrationsFolder });
  console.log("[migrate] migrations applied");
} finally {
  await pool.end();
}
