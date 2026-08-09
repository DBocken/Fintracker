/**
 * Persistierte Form der Nutzer-Einstellungen.
 *
 * Domäne, nicht Speicherung — der `local-settings-service` speichert sie,
 * besitzt die Form aber nicht (AGENTS.md §3). Diese Datei ist Teil der
 * Aufteilung von `src/types.ts` (WP 5.2, DOM-3).
 */
import type { GentleLevel } from '@/lib/gentle-mode';
import type { LifeSituationId, ModifierId, NavFeatureId } from '@/lib/life-situations';
import type { TutorialChapterId, TutorialSource } from '@/lib/tutorial-sequence';

export interface UserSettings {
  user_id: string;
  auto_confirm_mapping: boolean;
  retention_months: number;
  default_currency?: string;
  enable_subcategories: boolean;
  theme?: string;
  kpi_prefs?: {
    order: string[];
    active: string[];
  };
  preferred_market_provider?: 'yahoo' | 'stooq';
  /**
   * Stufe des Sanften Modus (`@/lib/gentle-mode`). `0` ist aus, `3` verdeckt
   * alles. Begründung der Reihenfolge: `docs/debt-avoidance-recovery.md`.
   */
  gentle_level?: GentleLevel;
  /**
   * @deprecated Abgelöst durch {@link UserSettings.gentle_level}. Das Feld
   * existiert nur noch, damit die einmalige Migration in
   * `local-settings-service` Altbestände lesen und räumen kann — es wird
   * nirgends mehr geschrieben.
   */
  gentle_mode?: boolean;
  /** Empfohlener Steuer-Rücklage-Prozentsatz für Creator-/Selbstständigen-Einnahmen (0 = aus). */
  tax_reserve_percent?: number;
  /**
   * @deprecated Abgelöst: der Einzelunternehmer-Modus leitet sich heute aus dem
   * Bereich `euer` in {@link UserSettings.enabled_nav_features} ab
   * (`isBusinessModeEnabled`). Das Feld existiert nur noch, damit die einmalige
   * Migration in `local-settings-service` Altbestände lesen und räumen kann —
   * es wird nirgends mehr geschrieben.
   */
  business_mode?: boolean;
  /** Im Onboarding gewählte Lebenssituation. Dient nur der Vorauswahl. */
  onboarding_life_situation?: LifeSituationId | null;
  /** Zusätzlich gewählte Umstände (rein additiv, siehe `@/lib/life-situations`). */
  onboarding_modifiers?: ModifierId[];
  /**
   * Sichtbare Nav-Bereiche. Bewusst die *bestätigte Nutzerauswahl* und nicht
   * der Lebenssituation selbst: nur so überschreibt ein späterer Wechsel der Lebenssituation
   * keine manuell getroffenen Entscheidungen. `null`/undefined = Onboarding
   * nicht durchlaufen ⇒ alles sichtbar (Bestandsnutzer).
   */
  enabled_nav_features?: NavFeatureId[] | null;
  /**
   * Freigeschaltete Nav-Bereiche — die Tempo-Achse des Tutorials, additiv neben
   * {@link enabled_nav_features}. Sichtbar ist ein Bereich, wenn er *gewählt
   * UND freigeschaltet* ist (`isNavPathVisible`).
   *
   * `null`/undefined = Freischaltung nicht in Gebrauch ⇒ alles freigeschaltet.
   * Bestandsnutzer haben das Feld nicht und dürfen dadurch nichts verlieren;
   * scharf wird die Achse erst, wenn das Tutorial sie ausdrücklich setzt.
   * „Alles freischalten" in den Einstellungen setzt sie wieder auf `null`.
   */
  unlocked_features?: NavFeatureId[] | null;
  /**
   * In der Datenquellen-Weiche (Kapitel 0) gewählter Weg.
   *
   * `undefined` = nie gefragt (die Weiche erscheint), `null` = gefragt und
   * übersprungen. Gespeichert wird der **gewählte Weg**, nicht was tatsächlich
   * an Daten vorliegt: Wer „Bank" wählt und abbricht, soll das unterbrochene
   * Tutorial an derselben Stelle fortsetzen. Über Sichtbarkeit entscheiden
   * weiterhin die echten Daten.
   */
  tutorial_source?: TutorialSource | null;
  /** Abgeschlossene Tutorial-Kapitel. Unbekannte IDs werden ignoriert. */
  tutorial_completed_chapters?: TutorialChapterId[];
}
