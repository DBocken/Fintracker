import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/** Der eine Adressparameter für alle Detailschritte (ADR Regel 9b). */
export const DETAIL_PARAM = "detail";

/**
 * Der Detailschritt einer Fläche — adressierbar, mit Zurücktaste bedienbar.
 *
 * Elf von zwölf Flächen-Entwürfen haben dafür den Coach von Hand abgeschrieben.
 * Hier steht er einmal, samt der beiden Regeln, die dabei jedes Mal neu
 * getroffen werden mussten:
 *
 * **Öffnen legt einen Verlaufseintrag an, Schliessen ersetzt ihn.** Der Coach
 * hatte anfangs in BEIDEN Richtungen ersetzt, und der Kommentar daneben
 * behauptete, die Zurücktaste schliesse den Schritt — sie tat es nicht: Ohne
 * Verlaufseintrag springt sie auf die vorige Route. Auf einem Telefon ist das
 * der häufigste Handgriff überhaupt, und er führte aus der Fläche heraus statt
 * aus dem Sheet.
 *
 * **Fremde Parameter bleiben stehen.** Der Schritt schreibt ausschliesslich
 * seinen eigenen Schlüssel und lässt alles andere unberührt. Das ist nicht
 * Vorsicht, sondern ein gemessener Befund: Auf `/transactions` spiegelt ein
 * Effekt den Filterzustand in die Adresse und baut die Abfragezeichenkette
 * dabei komplett NEU. Ein Detailschritt, der sich seine Adresse ebenso neu
 * baut, loescht den Filter — und umgekehrt loescht die Filterspiegelung den
 * Detailschritt. Beide Seiten muessen zusammenfuehren; diese ist die eine
 * Haelfte davon.
 *
 * @param wert Der Wert des Parameters, etwa `"lage"` → `?detail=lage`. Er
 *   benennt den Abschnitt, nicht die Flaeche: Eine Flaeche kann mehrere
 *   Detailschritte haben, und in einer geteilten Adresse muss lesbar sein,
 *   welcher gemeint ist.
 */
export function useDetailParam(wert: string) {
  const [params, setParams] = useSearchParams();

  const offen = params.get(DETAIL_PARAM) === wert;

  const setOffen = useCallback(
    (nunOffen: boolean) => {
      const naechste = new URLSearchParams(params);
      if (nunOffen) naechste.set(DETAIL_PARAM, wert);
      else naechste.delete(DETAIL_PARAM);
      setParams(naechste, { replace: !nunOffen });
    },
    [params, setParams, wert],
  );

  return useMemo(
    () => ({
      /** Steht dieser Detailschritt gerade offen? */
      offen,
      /** Für `onOpenChange` eines Sheets oder Dialogs. */
      setOffen,
      oeffnen: () => setOffen(true),
      schliessen: () => setOffen(false),
    }),
    [offen, setOffen],
  );
}
