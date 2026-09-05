import { createContext, useContext, type ReactNode } from "react";

/**
 * Wer trägt den Seitennamen — die Shell oder die Fläche selbst?
 *
 * Der Name stand bisher DOPPELT: einmal in der App-Leiste, wo er auf 360 px
 * auf zwei Zeichen abgeschnitten wurde („Ei…", „A…", „V…"), und einmal als
 * Überschrift im Inhalt. Ein abgeschnittener Name ist schlechter als keiner —
 * er kostet Platz und sagt nichts.
 *
 * In der fokussierten Dichte rendert die Shell den Namen deshalb EINMAL im
 * Inhalt. Damit die Fläche ihn nicht ein zweites Mal setzt, sagt dieser
 * Kontext ihr, ob das bereits geschehen ist.
 *
 * WARUM EIN KONTEXT UND KEINE CSS-REGEL. Die Antwort muss beim ersten Rendern
 * feststehen, sonst blitzt der doppelte Name auf. Die Shell weiss sie in dem
 * Moment, in dem sie selbst rendert — sie kennt Route und Dichte. Eine
 * nachträgliche Unterdrückung („blende aus, falls weiter unten noch eine
 * Überschrift kommt") bräuchte einen zweiten Durchlauf.
 *
 * WARUM NICHT IMMER DIE SHELL. Nicht jede Route hat einen kanonischen Namen:
 * Flächen ausserhalb der Navigation (etwa die Abrechnung) haben keinen
 * Navigationseintrag, aus dem er käme. Dort bleibt die Fläche zuständig, und
 * der Kontext meldet `false`.
 */
const SeitennameContext = createContext(false);

export function SeitennameProvider({
  traegtDieShell,
  children,
}: {
  traegtDieShell: boolean;
  children: ReactNode;
}) {
  return (
    <SeitennameContext.Provider value={traegtDieShell}>{children}</SeitennameContext.Provider>
  );
}

/**
 * `true`, wenn die Shell den Seitennamen bereits im Inhalt rendert. Eine
 * Fläche unterdrückt dann ihre eigene Überschrift — nicht ihren Beschreibungs-
 * text und nicht ihre Bedienelemente.
 */
export function useShellTraegtSeitenname(): boolean {
  return useContext(SeitennameContext);
}

/**
 * Die Klasse, mit der eine flaecheneigene Ueberschrift sich zurueckzieht,
 * solange die Shell den Namen traegt — leer, wenn sie ihn selbst setzen muss.
 *
 * **Warum als Haken und nicht als Handgriff je Flaeche.** `PageHeader` hatte
 * diese Entscheidung zuerst, und die Annahme dahinter war, jede Flaeche fuehre
 * ihren Namen darueber. Gemessen stimmte das nicht: `/settings`, `/city`,
 * `/fragen` und `/trading` bringen ihre eigene `<h1>` mit, und dort stand der
 * Name nach dem Umbau ZWEIMAL. Aufgefallen ist es nicht im Test, sondern in
 * CI — Playwright brach mit „strict mode violation: resolved to 2 elements"
 * ab, weil zwei Ueberschriften „Finanzstadt" hiessen. Zwei `<h1>` auf einem
 * Bildschirm sind aber kein Testproblem, sondern eines fuer jede Sprachausgabe.
 *
 * Eine Klasse an vier Stellen abzuschreiben haette denselben Fehler ein
 * fuenftes Mal moeglich gemacht. Hier steht er einmal.
 */
export function useSeitennameVerdeckung(): string {
  return useShellTraegtSeitenname() ? "fokussiert:hidden" : "";
}
