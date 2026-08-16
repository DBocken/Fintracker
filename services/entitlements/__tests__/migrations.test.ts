import { describe, expect, it } from "vitest";
import { planMigrations, type AppliedMigration, type MigrationFile } from "../src/db/migrations.js";

const datei = (version: string, checksum: string): MigrationFile => ({
  version,
  name: `${version}_x.sql`,
  sql: "-- egal",
  checksum,
});

const angewandt = (version: string, checksum: string): AppliedMigration => ({ version, checksum });

/**
 * Der belegte Weg vom Repo zum Schema (WP 6.2, Bauvorgabe aus dem
 * Supabase-Befund).
 *
 * Das Supabase-Projekt zeigt `No migrations`, während das Repo 17 SQL-Dateien
 * führt und kein CI-Schritt sie anwendet. Damit ist unbekannt, welche davon
 * tatsächlich im Schema stehen — für eine Wiederherstellung und für die
 * Portierung in Phase 7 ist das genau die Auskunft, die man braucht.
 *
 * Hier wird das nicht wiederholt. Die Prüfungen darunter sind der Unterschied
 * zwischen „wir haben Dateien" und „wir wissen, was läuft".
 */
describe("planMigrations", () => {
  it("sollte nur die noch nicht angewandten Migrationen liefern — in Reihenfolge", () => {
    const plan = planMigrations(
      [datei("002", "b"), datei("001", "a"), datei("003", "c")],
      [angewandt("001", "a")],
    );

    expect(plan.pending.map((m) => m.version)).toEqual(["002", "003"]);
  });

  it("sollte nichts zu tun haben, wenn alles angewandt ist", () => {
    const plan = planMigrations([datei("001", "a")], [angewandt("001", "a")]);
    expect(plan.pending).toEqual([]);
  });

  it("[SECURITY] sollte eine nachträglich GEÄNDERTE Migration als Fehler melden", () => {
    // Das ist die Prüfung, die aus Dateien eine Auskunft macht. Wer eine
    // bereits angewandte Migration editiert, erzeugt ein Schema, das mit dem
    // Repo nicht mehr übereinstimmt — und niemand merkt es, weil die
    // Versionsnummer gleich blieb.
    expect(() =>
      planMigrations([datei("001", "GEAENDERT")], [angewandt("001", "a")]),
    ).toThrow(/001/);
  });

  it("sollte eine angewandte, aber verschwundene Migration als Fehler melden", () => {
    // Gegenrichtung: Die Datenbank kennt einen Schritt, den das Repo nicht
    // mehr hat. Dann beschreibt das Repo das Schema nicht mehr vollständig.
    expect(() => planMigrations([datei("002", "b")], [angewandt("001", "a")])).toThrow(/001/);
  });

  it("sollte doppelte Versionsnummern ablehnen", () => {
    // Zwei Dateien mit derselben Nummer: Welche gilt? Die Frage darf gar nicht
    // erst entstehen.
    expect(() => planMigrations([datei("001", "a"), datei("001", "b")], [])).toThrow(/001/);
  });

  it("sollte eine Luecke vor einer bereits angewandten Migration melden", () => {
    // Ein spaeter eingefuegter Schritt mit kleinerer Nummer wuerde entweder
    // uebersprungen oder in falscher Reihenfolge laufen.
    expect(() =>
      planMigrations([datei("001", "a"), datei("002", "b")], [angewandt("002", "b")]),
    ).toThrow(/001/);
  });
});
