import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { checksumOf, planMigrations, type MigrationFile } from "./db/migrations.js";
import { createPool } from "./db/postgres.js";

/**
 * Migrations-Läufer (WP 6.2).
 *
 * Läuft in CI gegen ein Wegwerf-Postgres und beweist damit, was beim
 * Supabase-Bestand fehlt: dass ein **leeres** Postgres allein aus dem Repo
 * auf den aktuellen Stand kommt. Die Prüfregeln stehen in `db/migrations.ts`
 * und sind ohne Datenbank getestet.
 */

const HIER = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HIER, "../migrations");

export function readMigrationFiles(dir = MIGRATIONS_DIR): MigrationFile[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => {
      const sql = fs.readFileSync(path.join(dir, name), "utf8");
      const version = name.split("_")[0] ?? name;
      return { version, name, sql, checksum: checksumOf(sql) };
    });
}

async function ensureVersionTable(pool: Pool): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version     TEXT PRIMARY KEY,
       checksum    TEXT NOT NULL,
       applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
}

export async function migrate(pool: Pool): Promise<{ applied: string[] }> {
  await ensureVersionTable(pool);

  const { rows } = await pool.query(`SELECT version, checksum FROM schema_migrations`);
  const angewandt = rows.map((r) => ({ version: r.version as string, checksum: r.checksum as string }));

  const { pending } = planMigrations(readMigrationFiles(), angewandt);

  const applied: string[] = [];
  for (const migration of pending) {
    // Jede Migration in EINER Transaktion samt ihrem Versionseintrag: Bricht
    // sie ab, gibt es weder halbes Schema noch einen Eintrag, der ein volles
    // behauptet.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)`,
        [migration.version, migration.checksum],
      );
      await client.query("COMMIT");
      applied.push(migration.version);
    } catch (fehler) {
      await client.query("ROLLBACK");
      throw fehler;
    } finally {
      client.release();
    }
  }

  return { applied };
}

// Direktaufruf: `pnpm migrate`
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL fehlt.");
    process.exit(1);
  }
  const pool = createPool(url);
  migrate(pool)
    .then(({ applied }) => {
      console.log(
        applied.length > 0
          ? `✅ ${applied.length} Migration(en) angewandt: ${applied.join(", ")}`
          : "✅ Schema ist aktuell",
      );
      return pool.end();
    })
    .catch(async (fehler) => {
      console.error(`❌ ${fehler instanceof Error ? fehler.message : String(fehler)}`);
      await pool.end();
      process.exit(1);
    });
}
