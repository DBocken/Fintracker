import { createHash } from "node:crypto";

/**
 * Migrationsplanung (WP 6.2) — reine Logik, ohne Datenbank prüfbar.
 *
 * **Warum das hier so gründlich ist.** Das Supabase-Projekt zeigt
 * `Last Migration: No migrations`, während das Repo 17 SQL-Dateien führt und
 * kein CI-Schritt sie anwendet (Beleg: `docs/betrieb-2026-08/belege/`). Damit
 * ist unbekannt, welche Schritte tatsächlich im Schema stehen. Für eine
 * Wiederherstellung und für die Portierung in Phase 7 ist das genau die
 * Auskunft, die man braucht — und genau die, die dort fehlt.
 *
 * Eine Versionstabelle allein liefert sie noch nicht. Erst die
 * **Prüfsummen-Kontrolle** macht aus „wir haben Dateien" ein „wir wissen, was
 * läuft": Wer eine bereits angewandte Migration nachträglich ändert, erzeugt
 * sonst ein Schema, das mit dem Repo nicht mehr übereinstimmt, ohne dass
 * irgendetwas rot wird.
 */

export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  checksum: string;
}

export interface MigrationPlan {
  pending: MigrationFile[];
}

export function checksumOf(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

export function planMigrations(
  dateien: MigrationFile[],
  angewandt: AppliedMigration[],
): MigrationPlan {
  const sortiert = [...dateien].sort((a, b) => a.version.localeCompare(b.version));

  const gesehen = new Set<string>();
  for (const datei of sortiert) {
    if (gesehen.has(datei.version)) {
      throw new Error(
        `Migration ${datei.version} existiert doppelt — welche gilt? Versionsnummern sind eindeutig.`,
      );
    }
    gesehen.add(datei.version);
  }

  const nachVersion = new Map(sortiert.map((d) => [d.version, d]));

  for (const eintrag of angewandt) {
    const datei = nachVersion.get(eintrag.version);
    if (!datei) {
      throw new Error(
        `Migration ${eintrag.version} ist angewandt, fehlt aber im Repo — das Repo beschreibt das Schema nicht mehr vollständig.`,
      );
    }
    if (datei.checksum !== eintrag.checksum) {
      throw new Error(
        `Migration ${eintrag.version} wurde nach dem Anwenden geändert. Das Schema stimmt nicht mehr mit dem Repo überein; eine Korrektur gehört in eine NEUE Migration.`,
      );
    }
  }

  const angewandteVersionen = new Set(angewandt.map((a) => a.version));
  const hoechsteAngewandte = [...angewandteVersionen].sort().at(-1);

  const pending = sortiert.filter((d) => !angewandteVersionen.has(d.version));

  if (hoechsteAngewandte) {
    const zuSpaeteinfuegung = pending.find((d) => d.version < hoechsteAngewandte);
    if (zuSpaeteinfuegung) {
      throw new Error(
        `Migration ${zuSpaeteinfuegung.version} liegt vor der bereits angewandten ${hoechsteAngewandte} — sie würde in falscher Reihenfolge laufen. Neue Schritte bekommen eine höhere Nummer.`,
      );
    }
  }

  return { pending };
}
