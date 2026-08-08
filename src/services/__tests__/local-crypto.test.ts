import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  estimatePasswordStrength,
  isLocalEncryptionWriteInFlight,
  localEncryption,
  LocalEncryptionLockedError,
  onLocalEncryptionActivity,
  onLocalEncryptionWriteSettled,
  VaultCorruptError,
} from "../local-crypto";
import { clearLocalKvStore, idbGet, idbSet } from "../idb-kv";
import {
  LOCAL_FINANCE_KEYS,
  LOCAL_CATEGORIES_KEY,
  LOCAL_SETTINGS_KEY,
  ENCRYPTED_STORAGE_KEYS,
} from "../local-storage-keys";

describe("localEncryption", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  afterEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it("is disabled until enable() is called", () => {
    expect(localEncryption.isEnabled()).toBe(false);
    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it("encrypts and decrypts JSON values round-trip after enable()", async () => {
    await localEncryption.enable("correct horse battery staple");
    expect(localEncryption.isEnabled()).toBe(true);
    expect(localEncryption.isUnlocked()).toBe(true);

    const payload = { transactions: [{ id: "t1", amount: -12.34 }] };
    const envelope = await localEncryption.encryptJson(payload);
    expect(envelope.type).toBe("ausgabentracker.enc");

    const decrypted = await localEncryption.decryptJson<typeof payload>(envelope);
    expect(decrypted).toEqual(payload);
  });

  it("unlocks with the correct password after a lock", async () => {
    await localEncryption.enable("correct horse battery staple");
    localEncryption.lock();
    expect(localEncryption.isUnlocked()).toBe(false);

    await localEncryption.unlock("correct horse battery staple");
    expect(localEncryption.isUnlocked()).toBe(true);
  });

  it("rejects an incorrect password with 'Falsches Passwort'", async () => {
    await localEncryption.enable("correct horse battery staple");
    localEncryption.lock();

    await expect(localEncryption.unlock("wrong password")).rejects.toThrow(
      "Falsches Passwort"
    );
    expect(localEncryption.isUnlocked()).toBe(false);
  });

  it("throws LocalEncryptionLockedError when locked but enabled", async () => {
    await localEncryption.enable("correct horse battery staple");
    localEncryption.lock();

    expect(() => localEncryption.requireUnlocked()).toThrow(LocalEncryptionLockedError);
    await expect(localEncryption.encryptJson({ a: 1 })).rejects.toThrow(
      LocalEncryptionLockedError
    );
  });

  it("encryptAndStore writes plaintext to IndexedDB when encryption is disabled", async () => {
    await localEncryption.encryptAndStore("test_key", { foo: "bar" });
    const raw = await idbGet("test_key");
    expect(raw).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("encryptAndStore writes an encrypted envelope to IndexedDB when enabled and unlocked", async () => {
    await localEncryption.enable("correct horse battery staple");
    await localEncryption.encryptAndStore("test_key", { foo: "bar" });

    const raw = await idbGet("test_key");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.type).toBe("ausgabentracker.enc");

    const loaded = await localEncryption.loadAndMaybeDecrypt<{ foo: string }>("test_key");
    expect(loaded).toEqual({ foo: "bar" });
  });

  it("[REGRESSION] Roundtrip über die 8-KB-Base64-Blockgrenze (F-PERF-1)", async () => {
    await localEncryption.enable("super-geheim-123");
    // Payload deutlich größer als die 8-KB-Chunkgröße des blockweisen b64encode,
    // inkl. Nicht-ASCII, um korrektes Kodieren über Blockgrenzen zu prüfen.
    const large = {
      items: Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        payee: `Händler Ä${i} — Straße`,
        amount: -i - 0.99,
      })),
    };
    const envelope = await localEncryption.encryptJson(large);
    const back = await localEncryption.decryptJson<typeof large>(envelope);
    expect(back).toEqual(large);
  });
});

describe("loadAndMaybeDecrypt: korrupte Envelopes werfen statt zu schlucken (RES-1)", () => {
  const KEY = "corrupt_test_key";

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  afterEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it("[REGRESSION] (a) wirft VaultCorruptError, wenn der Rohwert kein JSON ist", async () => {
    await localEncryption.enable("ein-sicheres-passwort");
    await idbSet(KEY, "{das ist kein json");

    await expect(localEncryption.loadAndMaybeDecrypt(KEY)).rejects.toBeInstanceOf(
      VaultCorruptError,
    );
  });

  it("[REGRESSION] (b) wirft VaultCorruptError, wenn ct_b64 eines gueltigen Envelopes verfaelscht ist", async () => {
    await localEncryption.enable("ein-sicheres-passwort");
    const envelope = await localEncryption.encryptJson({ foo: "bar" });
    const tampered = { ...envelope, ct_b64: envelope.ct_b64.slice(0, -4) + "AAAA" };
    await idbSet(KEY, JSON.stringify(tampered));

    await expect(localEncryption.loadAndMaybeDecrypt(KEY)).rejects.toBeInstanceOf(
      VaultCorruptError,
    );
  });

  it("[REGRESSION] (c) wirft VaultCorruptError, wenn die entschluesselten Bytes kein JSON ergeben", async () => {
    await localEncryption.enable("ein-sicheres-passwort");
    // Envelope aus einem Nicht-JSON-Klartext bauen: direkt ueber die
    // Standalone-Verschluesselung mit demselben Passwort verschluesseln reicht
    // nicht (encryptString erwartet bereits JSON-Text als Input), daher wird
    // hier ein echter Envelope genommen und der Klartext-Erwartungswert durch
    // Bauen ueber encryptJson mit einem String simuliert, der beim Zurueck-
    // Parsen kein gueltiges JSON ist.
    const key = localEncryption.requireUnlocked();
    const cfg = localEncryption.getConfig()!;
    const ivU8 = crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode("kein-json-text");
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivU8 }, key, pt);
    const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
    const ivB64 = btoa(String.fromCharCode(...ivU8));
    const envelope = {
      type: "ausgabentracker.enc",
      v: 1,
      kdf: cfg.kdf,
      cipher: { name: "AES-GCM", iv_b64: ivB64 },
      ct_b64: ctB64,
    };
    await idbSet(KEY, JSON.stringify(envelope));

    await expect(localEncryption.loadAndMaybeDecrypt(KEY)).rejects.toBeInstanceOf(
      VaultCorruptError,
    );
  });

  it("(d) liefert weiterhin null, wenn der Key gar nicht existiert", async () => {
    await localEncryption.enable("ein-sicheres-passwort");

    await expect(localEncryption.loadAndMaybeDecrypt("does_not_exist_key")).resolves.toBeNull();
  });

  it("(e) wirft weiterhin LocalEncryptionLockedError bei gesperrtem Vault, nicht VaultCorruptError", async () => {
    await localEncryption.enable("ein-sicheres-passwort");
    await idbSet(KEY, JSON.stringify(await localEncryption.encryptJson({ foo: "bar" })));
    localEncryption.lock();

    await expect(localEncryption.loadAndMaybeDecrypt(KEY)).rejects.toBeInstanceOf(
      LocalEncryptionLockedError,
    );
  });
});

describe("localEncryption enable/disable Migration (F-CRYPTO-1)", () => {
  const PW = "correct horse battery staple";

  beforeEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });
  afterEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  // Repräsentative Auswahl inkl. Keys, die die alte 7er-Handliste NICHT kannte
  // (budgets, transactionAllocations, receivables, claims, merchantRules,
  // households, Kategorien, Settings) — genau diese gingen bei disable() verloren.
  const samples: Record<string, unknown> = {
    [LOCAL_FINANCE_KEYS.transactions]: [{ id: "t1", amount: -12.34 }],
    [LOCAL_FINANCE_KEYS.budgets]: [{ id: "b1", limit: 100 }],
    [LOCAL_FINANCE_KEYS.transactionAllocations]: [{ id: "a1", amount_minor: 50 }],
    [LOCAL_FINANCE_KEYS.receivables]: [{ id: "r1" }],
    [LOCAL_FINANCE_KEYS.claims]: [{ id: "c1" }],
    [LOCAL_FINANCE_KEYS.merchantRules]: [{ id: "m1" }],
    [LOCAL_FINANCE_KEYS.households]: [{ id: "h1" }],
    [LOCAL_CATEGORIES_KEY]: [{ id: "cat1", name: "Wohnen" }],
    [LOCAL_SETTINGS_KEY]: { locale: "de" },
  };

  it("[REGRESSION] disable() entschlüsselt ALLE registrierten Keys zurück (kein Datenverlust)", async () => {
    await localEncryption.enable(PW);

    for (const [key, value] of Object.entries(samples)) {
      await localEncryption.encryptAndStore(key, value);
      const raw = await idbGet(key);
      expect(JSON.parse(raw!).type).toBe("ausgabentracker.enc"); // liegt als Envelope
    }

    await localEncryption.disable(PW);
    expect(localEncryption.isEnabled()).toBe(false);

    for (const [key, value] of Object.entries(samples)) {
      const raw = await idbGet(key);
      const parsed = JSON.parse(raw!);
      expect(parsed.type).not.toBe("ausgabentracker.enc"); // kein Envelope-Rest
      expect(parsed).toEqual(value); // exakt der Ausgangswert
    }
  });



  it("[REGRESSION] enable() verschlüsselt ALLE registrierten Klartext-Keys sofort", async () => {
    for (const key of ENCRYPTED_STORAGE_KEYS) {
      await idbSet(key, JSON.stringify([{ id: key, marker: `klartext-${key}` }]));
    }

    await localEncryption.enable(PW);

    for (const key of ENCRYPTED_STORAGE_KEYS) {
      const raw = await idbGet(key);
      expect(raw).toBeTruthy();
      expect(raw).not.toContain(`klartext-${key}`);
      expect(JSON.parse(raw!).type).toBe("ausgabentracker.enc");
    }
  });

  it("[REGRESSION] enable() migriert Legacy-localStorage-Daten nach IndexedDB und verschlüsselt sie", async () => {
    const legacyKey = LOCAL_FINANCE_KEYS.taxReserves;
    localStorage.setItem(legacyKey, JSON.stringify([{ id: "tax-1", marker: "legacy-klartext" }]));

    await localEncryption.enable(PW);

    const raw = await idbGet(legacyKey);
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("legacy-klartext");
    expect(JSON.parse(raw!).type).toBe("ausgabentracker.enc");
    await expect(localEncryption.loadAndMaybeDecrypt(legacyKey)).resolves.toEqual([
      { id: "tax-1", marker: "legacy-klartext" },
    ]);
  });

  it("[REGRESSION] wirft beim Lesen, wenn bei deaktivierter Verschlüsselung ein Envelope zurückbleibt", async () => {
    await localEncryption.enable(PW);
    const key = LOCAL_FINANCE_KEYS.budgets;
    await localEncryption.encryptAndStore(key, [{ id: "b1" }]);
    const envelopeRaw = await idbGet(key);

    // Verschlüsselung ohne Migration deaktivieren (simuliert inkonsistenten Rest).
    localEncryption.lock();
    localStorage.clear(); // entfernt Config -> gilt als deaktiviert
    localStorage.setItem("ausgabentracker_locale_v1", "de"); // Locale ist keine Verschlüsselungs-Config, bleibt erhalten
    await idbSet(key, envelopeRaw!); // Envelope bleibt in IDB

    await expect(localEncryption.loadAndMaybeDecrypt(key)).rejects.toThrow(/Migration unvollständig/);
  });
});

describe("estimatePasswordStrength", () => {
  // WP 3.3 (SEC-3): `label` (übersetzter Anzeigetext, hartkodiert Deutsch)
  // wurde durch `category` ersetzt — eine stabile, nicht-übersetzte Kategorie
  // ('weak' | 'medium' | 'strong'). Die Übersetzung des Anzeigetexts liegt
  // jetzt in der Komponente (`useI18n()`); die Kategorie ist zugleich die
  // Gate-Schwelle für den Setup-Button in `LocalEncryptionSettings`.
  it("classifies short, simple passwords as weak", () => {
    expect(estimatePasswordStrength("abc").category).toBe("weak");
    expect(estimatePasswordStrength("").category).toBe("weak");
  });

  it("classifies medium-length mixed passwords as medium", () => {
    const result = estimatePasswordStrength("Abcdefgh1");
    expect(result.category).toBe("medium");
  });

  it("classifies long passwords with mixed character classes as strong", () => {
    const result = estimatePasswordStrength("Correct-Horse-Battery-9");
    expect(result.category).toBe("strong");
  });

  it("erkennt reine Wiederholung trotz Länge als weak (Entropie statt Länge)", () => {
    expect(estimatePasswordStrength("aaaaaaaaaaaa").category).toBe("weak");
  });

  it("wertet einfache Sequenzen ab", () => {
    expect(estimatePasswordStrength("abcdefghijkl").category).toBe("weak");
  });

  it("wertet gängige Passwörter hart ab", () => {
    const res = estimatePasswordStrength("Passwort123!");
    expect(res.category).toBe("weak");
    expect(res.score).toBeLessThanOrEqual(25);
  });
});

// WP 3.2 (SEC-2): Auto-Lock-Einstellung. Bewusst in localStorage (Klartext),
// nicht im verschlüsselten Bestand — siehe Begründung bei AUTO_LOCK_KEY in
// local-crypto.ts. Deshalb hier geprüft: die Einstellung ist unabhängig vom
// Tresor-Zustand lesbar/schreibbar und überlebt einen "Neustart" (= sie liegt
// in localStorage, nicht in einer In-Memory-Variable dieses Moduls).
describe("Auto-Lock-Einstellung (WP 3.2 / SEC-2)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  it("sollte ohne gespeicherten Wert den Standard von 10 Minuten liefern", () => {
    expect(localEncryption.getAutoLockMinutes()).toBe(10);
  });

  it("sollte einen gesetzten Minutenwert zurückliefern", () => {
    localEncryption.setAutoLockMinutes(15);
    expect(localEncryption.getAutoLockMinutes()).toBe(15);
  });

  it("sollte 'never' als Einstellung akzeptieren und zurückliefern", () => {
    localEncryption.setAutoLockMinutes("never");
    expect(localEncryption.getAutoLockMinutes()).toBe("never");
  });

  it("sollte die Einstellung in localStorage persistieren, nicht nur im Speicher (übersteht einen 'Neustart')", () => {
    localEncryption.setAutoLockMinutes(30);

    // Ein Neustart hat kein Modul-Gedächtnis mehr — nur was in localStorage
    // steht, kommt danach zurück. Direkt am Rohwert geprüft, damit der Test
    // nicht bloß den eigenen Setter gegen den eigenen Getter testet.
    expect(localStorage.getItem("ausgabentracker_local_encryption_autolock_v1")).toBe("30");

    localStorage.setItem("ausgabentracker_local_encryption_autolock_v1", "never");
    expect(localEncryption.getAutoLockMinutes()).toBe("never");
  });

  it("sollte bei einem kaputten/ungültigen gespeicherten Wert auf den Standard zurückfallen", () => {
    localStorage.setItem("ausgabentracker_local_encryption_autolock_v1", "kein-zahlenwert");
    expect(localEncryption.getAutoLockMinutes()).toBe(10);
  });
});

// WP 3.2 (SEC-2): Aktivitäts-Kanal für laufende Schreibvorgänge. Ein langer
// Import oder eine Massenumschlüsselung (migrateFinanceKeys, rewrapIfNeeded)
// hat oft keine Maus-/Tastatur-Aktivität, würde vom Inaktivitäts-Timer aber
// trotzdem mittendrin gesperrt — schlimmer als kein Auto-Lock (siehe
// requireUnlocked(), das dann werfen würde). writeDataRaw() ist der einzige
// Schreibpfad in den Bestand; ein Puls dort deckt jeden Schreibvorgang ab.
describe("Aktivitäts-Kanal für Schreibvorgänge (WP 3.2 / SEC-2)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  it("sollte bei jedem Schreibvorgang registrierte Aktivitäts-Listener benachrichtigen", async () => {
    const listener = vi.fn();
    const unsubscribe = onLocalEncryptionActivity(listener);

    await localEncryption.encryptAndStore("activity_key", { a: 1 });
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it("sollte einen abgemeldeten Listener nicht mehr benachrichtigen", async () => {
    const listener = vi.fn();
    const unsubscribe = onLocalEncryptionActivity(listener);
    unsubscribe();

    await localEncryption.encryptAndStore("activity_key", { a: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});

// WP 3.2 (SEC-2, "Vorentschieden" im Plan): zweite, unabhängige Auto-Lock-
// Einstellung — Lock bei visibilitychange → hidden. Standard AUS (sonst
// sperrt die App bei jedem Tab-Wechsel und die Einstellung wird abgeschaltet,
// bevor sie irgendetwas schützt). Dieselbe Persistenz-Begründung wie bei der
// Frist oben: Klartext-localStorage, unabhängig vom Tresor-Zustand lesbar.
describe("Lock-bei-Tab-Wechsel-Einstellung (WP 3.2 / SEC-2)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  it("[SECURITY] sollte ohne gespeicherten Wert AUS (false) liefern", () => {
    expect(localEncryption.getLockOnHidden()).toBe(false);
  });

  it("[SECURITY] sollte nach dem Einschalten true liefern", () => {
    localEncryption.setLockOnHidden(true);
    expect(localEncryption.getLockOnHidden()).toBe(true);
  });

  it("[SECURITY] sollte die Einstellung in localStorage persistieren (übersteht einen 'Neustart')", () => {
    localEncryption.setLockOnHidden(true);
    // Direkt am Rohwert geprüft — derselbe Grund wie beim Frist-Test oben:
    // nicht bloß den eigenen Setter gegen den eigenen Getter testen.
    expect(localStorage.getItem("ausgabentracker_local_encryption_lock_on_hidden_v1")).toBe("1");

    localStorage.setItem("ausgabentracker_local_encryption_lock_on_hidden_v1", "1");
    expect(localEncryption.getLockOnHidden()).toBe(true);

    localEncryption.setLockOnHidden(false);
    expect(localStorage.getItem("ausgabentracker_local_encryption_lock_on_hidden_v1")).toBeNull();
  });
});

// WP 3.2 (SEC-2): "Schreibvorgang läuft"-Zähler, den der Provider nutzt, um
// einen Lock-bei-Tab-Wechsel zu verschieben, statt einen mehrteiligen
// Schreibvorgang (z.B. restoreLocalCollections) mittendrin abzubrechen.
describe("Schreibvorgang-in-Arbeit-Kanal (WP 3.2 / SEC-2)", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ausgabentracker_locale_v1", "de");
    localEncryption.lock();
  });

  it("sollte außerhalb eines Schreibvorgangs false liefern", () => {
    expect(isLocalEncryptionWriteInFlight()).toBe(false);
  });

  it("sollte registrierte Listener benachrichtigen, sobald ein Schreibvorgang abgeschlossen ist", async () => {
    const listener = vi.fn();
    const unsubscribe = onLocalEncryptionWriteSettled(listener);

    await localEncryption.encryptAndStore("flight_key", { a: 1 });

    expect(listener).toHaveBeenCalled();
    expect(isLocalEncryptionWriteInFlight()).toBe(false);
    unsubscribe();
  });
});
