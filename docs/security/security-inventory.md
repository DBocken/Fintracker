# Fintracker Security Inventory

Stand: 18.07.2026
Pentest-Schritt: **7 — Retest und Lessons Learned abgeschlossen** nach vollständigem Scope-Durchlauf aus
`docs/security/pentest-scope.md`. Bericht: `docs/archive/pentest-report-2026-07-18.md`; Plan: `docs/archive/remediation-plan-2026-07-18.md`; Nachbericht: `docs/archive/pentest-after-report-2026-07-18.md`.

## 1. Aktueller Pentest-Status

| Schritt | Status | Evidenz |
|---|---|---|
| 1. Inventory | Abgeschlossen für Durchlauf 2026-07-18 | Storage-, Auth-, Sync-, Android- und Supply-Chain-Artefakte wurden für den vollständigen Scope-Durchlauf erfasst. |
| 2. Mapping | Abgeschlossen für Durchlauf 2026-07-18 | Findings sind den Testpaketen A-G im Pentest-Bericht zugeordnet. |
| 3. Automatisierte Baseline | Abgeschlossen und remediated | Vollständige Checkliste ausgeführt; `pnpm test`, Security/Privacy/Integrity/Mobile sind grün. |
| 4. Manuelle Angriffs-Sessions | Repo-/Localhost-statisch abgeschlossen | Kein Live-Test gegen Drittanbieter; manuelle Browser-/Android-Retests bleiben als Verification offen. |
| 5. Findings triagieren | Abgeschlossen für Bericht | Sieben Findings FT-2026-001 bis FT-2026-007 dokumentiert und bewertet. |
| 6. Fix + Regression | Abgeschlossen | Alle Findings aus dem Bericht wurden nach Remediation-Plan testgestützt behoben. |
| 7. Retest und Lessons Learned | Abgeschlossen | Vollständiger Retest und Nachbericht sind erstellt. |

## 2. Storage-Inventory und Klassifizierung

| Key/Quelle | Ort | Sensitivität | Paket | Entscheidung/Nächster Schritt |
|---|---|---:|---|---|
| `LOCAL_FINANCE_KEYS` | IndexedDB via `local-finance-store`/`idb-kv` | Kritisch | B/C | Bei `enable()` werden vorhandene Klartextwerte sofort in AES-GCM-Envelopes migriert. |
| `LOCAL_CATEGORIES_KEY`, `LOCAL_SETTINGS_KEY` | IndexedDB via `idb-kv`, Legacy-Fallback localStorage | Hoch | B | Teil von `ENCRYPTED_STORAGE_KEYS`; Legacy-localStorage wird nach IndexedDB migriert und verschlüsselt. |
| `ausgabentracker_mcp_connector_token_v1` | localStorage | Hoch | D/E | Legacy-Key wird aktiv bereinigt; Klartext-Token darf nicht mehr persistent gespeichert werden. |
| `ausgabentracker_mcp_connector_token_session_v1` | sessionStorage | Hoch | D/E | Akzeptiert als Session-Scope für einmalig angezeigte Connector-URL; wird bei Opt-out/Logout-Hilfslogik gelöscht. |
| `ausgabentracker_mcp_connector_active_v1` | localStorage | Niedrig-Mittel | D/E | Nicht-geheimer Aktivitätsmarker für Privacy-Indikator; enthält kein Token. |
| Error-Log | IndexedDB mit localStorage-Fallback | Hoch | A/B/D | Muss sensitive URLs, Tokens, Finanzlisten und Rohdateien redigieren. |
| `fintracker_forecast_overrides_v1` | IndexedDB via `localEncryption`, Legacy-Fallback localStorage | Hoch | B | Remediated: Legacy-localStorage wird migriert/gelöscht; bei aktiver lokaler Verschlüsselung AES-GCM-Envelope. |

## 3. MCP-P0-Status

| Flow | Status | Restarbeit |
|---|---|---|
| Lokale Connector-Token-Persistenz | Teilweise remediated | End-to-end im Browser gegen Reload/Logout prüfen. |
| Opt-out lokal | Teilweise remediated | Lokale Spuren werden nach erfolgreichem Supabase-Delete bereinigt. |
| Server-Connector `/api/mcp/[token]` | Teilweise remediated | Token-Format validiert, Hash-Lookup erzwungen, interne Fehler werden nicht roh zurückgegeben. |
| Standalone `mcp-poc` | Teilweise remediated | Token-Format validiert, Hash-Lookup erzwungen, generische Snapshot-Fehler. |
| Token-Rotation | Offen | Produktentscheidung: neue Verbindung erzeugt neuen Token/Hash; aktive alte Links müssen nach Opt-out ungültig sein. |

## 4. Backup-/Restore-P0-Status

| Flow | Status | Restarbeit |
|---|---|---|
| Generische Collections | Teilweise remediated | Nicht-destruktiver Merge per stabiler `id`; erneuter Restore dupliziert nicht. |
| Items ohne stabile ID | Gehärtet | Werden nicht in bestehende Collections gemergt, um unprüfbare Duplikate zu vermeiden. |
| Vollständiger Backup-Import | Teilweise remediated | Ende-zu-Ende-Test deckt Transaktionen, Kategorien, Accounts, Collections und Idempotenz-Zähler ab. |
| Restore-Semantik in UI | Teilweise remediated | Erfolgsansicht und Toast nennen neue Restore-Zähler plus Merge-/Skip-Semantik; manueller UX-Retest mit realer Datei bleibt offen. |

## 5. Priorisierte nächste Betriebs-/Monitoring-Schritte

1. **Threat-Intelligence-Routine:** monatlich Dependencies, CISA-KEV-Relevanz und neue OWASP-/MASVS-Änderungen prüfen.
2. **Manuelle Staging-Verifikation:** bei Releases Browser-/Android-Smoke-Tests für Crypto, Backup/Restore und Snapshot-Import mit synthetischen Dateien durchführen.
3. **Neue Findings:** wieder über Bericht → Remediation-Plan → Test vor Fix → Retest → Nachbericht abarbeiten.


## 6. Vollständiger Scope-Durchlauf 2026-07-18

- Bericht: `docs/archive/pentest-report-2026-07-18.md`
- Remediation-Plan: `docs/archive/remediation-plan-2026-07-18.md`
- Findings: FT-2026-001 bis FT-2026-007; alle fixed
- Nächster Arbeitsmodus: Betriebliches Monitoring und neue Findings nur über den dokumentierten Pentest-Prozess aufnehmen.

## Abschluss 2026-07-18

Der vollständige Scope-Durchlauf wurde abgeschlossen. Bericht, Remediation-Plan
und Nachbericht liegen unter `docs/archive/pentest-report-2026-07-18.md`,
`docs/archive/remediation-plan-2026-07-18.md` und
`docs/archive/pentest-after-report-2026-07-18.md`. Alle Findings aus dem
Bericht sind auf Fixed gesetzt und per vollständigem Retest verifiziert.
