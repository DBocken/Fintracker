# Slice `tax`

Heute nur `domain/questions.ts` — die zwei Registereinträge, mit denen der Chat
Gewinn (EÜR) und Steuerrücklage beantwortet.

**Warum eine Slice mit nur einem Ordner?** Die Steuer-Flächen liegen noch in
der Alt-Oberfläche (`src/pages/EuerPage.tsx`, `src/pages/TaxReportPage.tsx`,
`src/components/euer/`, `src/components/tax/`). Die Registereinträge gehören
laut `docs/architecture/feature-structure.md` NEBEN ihr Feature; sie in eine
fremde Slice zu legen, nur damit dort schon Nachbarn stehen, hätte die
Zugehörigkeit verwischt und den späteren Umzug erschwert.

Gerechnet wird ausschliesslich mit den vorhandenen reinen Funktionen
(`lib/euer-report.ts`, `lib/tax-reserve-tank.ts`, `lib/tax-reserve.ts`) — hier
steht keine zweite Steuerlogik.

Wandert die Oberfläche später hierher, kommen `presentation/` und
`application/` daneben; `domain/` bleibt, wo es ist.
