import type { FeatureKey } from "@/lib/tier";

export interface FeatureCopy {
  title: string;
  eyebrow: string;
  benefits: string[];
}

/**
 * Wortlaut zu einer gesperrten Funktion — die EINZIGE Stelle, an der die
 * `upsell.features.<key>.*`-Schlüssel dynamisch zusammengesetzt werden.
 *
 * Dass es genau eine ist, ist Absicht und nicht bloß Aufräumen: Dynamisch
 * gebaute Schlüssel sind der blinde Fleck von `call-site-keys.test.ts` (es
 * kann nicht prüfen, ob sie auflösen), und deren Zahl ist deshalb eine
 * Ratsche. Jede Fläche, die sich ihren Wortlaut selbst zusammensetzt,
 * vergrößert den Fleck; hier holen ihn sich `PremiumUpsell` (ganzseitige
 * Upgrade-Story) und `PremiumTeaser` (kleine Form) aus derselben Quelle.
 *
 * Ausgeleuchtet wird der Fleck nebenan: `__tests__/feature-copy.test.ts`
 * prüft für JEDEN `FeatureKey`, dass Titel, Eyebrow und die drei Nutzenpunkte
 * in allen Sprachen auflösen — genau das, was der Schlüssel-Test nicht sehen
 * kann.
 */
export function getFeatureCopy(
  t: (key: string) => string,
  feature: FeatureKey,
): FeatureCopy {
  return {
    title: t(`upsell.features.${feature}.title`),
    eyebrow: t(`upsell.features.${feature}.eyebrow`),
    benefits: [
      t(`upsell.features.${feature}.benefit1`),
      t(`upsell.features.${feature}.benefit2`),
      t(`upsell.features.${feature}.benefit3`),
    ],
  };
}
