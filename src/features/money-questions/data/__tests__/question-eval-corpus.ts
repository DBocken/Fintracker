/**
 * Eval-Korpus des Routers: die 225 Nutzerfragen aus dem WP-F-Auftrag.
 *
 * `familie` benennt die ZIEL-Funktion — den Registereintrag, der die Frage
 * beantworten soll, auch wenn er noch nicht gebaut ist. Der Ratschen-Test
 * leitet die Erwartung daraus ab, OB der Eintrag im Katalog existiert:
 *
 * - existiert er, muss der Router in dieser Familie landen (Antwort oder
 *   Slot-Rückfrage) oder sie in seinen Kandidaten führen;
 * - existiert er nicht (oder `familie: 'luecke'`), ist die richtige Reaktion
 *   die ABSTINENZ — Rückfrage oder „nicht verstanden", nie eine Antwort.
 *
 * Damit muss beim Bau einer Familie NICHTS umgelabelt werden: Der Eintrag
 * erscheint im Katalog, und dieselben Zeilen verlangen ab dann die Antwort.
 *
 * `'luecke'` ist eine ENTSCHEIDUNG, kein Backlog: Fragen, für die lokal keine
 * Datengrundlage existiert (Vertragsnutzung, Partner-Einkommen,
 * Freelancer-Tagessätze, Immobilienmodell) oder deren Antwort eine
 * mehrschrittige Optimierung wäre, die keine einzelne Funktion seriös
 * liefert. Die richtige Antwort darauf ist Ehrlichkeit, nicht eine Zahl.
 */

export interface KorpusZeile {
  frage: string;
  /** Ziel-Eintrags-ID oder 'luecke'. */
  familie: string;
}

const z = (frage: string, familie: string): KorpusZeile => ({ frage, familie });

export const EVAL_KORPUS: readonly KorpusZeile[] = [
  // ── Block 1: Einkommen & Gehalt ─────────────────────────────────────────
  z('Wann kam mein letztes Gehalt?', 'einkommen.letztes'),
  z('Wie hoch war mein letztes Gehalt?', 'einkommen.letztes'),
  z('Wie hoch ist mein durchschnittliches Nettogehalt der letzten sechs Monate?', 'einkommen.durchschnitt'),
  z('Wurde mein Bonus bereits ausgezahlt?', 'luecke'),
  z('War mein Gehalt diesen Monat niedriger als sonst?', 'einkommen.durchschnitt'),
  z('Welche zusätzlichen Einnahmen hatte ich diesen Monat neben meinem Gehalt?', 'luecke'),
  z('Wie viel Einkommen habe ich dieses Jahr bisher erhalten?', 'einnahmen.zeitraum'),
  z('Wie stark schwankt mein monatliches Einkommen?', 'einkommen.schwankung'),
  z('Wann kommt voraussichtlich mein nächstes Gehalt?', 'verfuegbar.bisGehalt'),
  z('Wie viel Geld werde ich bis zum nächsten Gehalt voraussichtlich noch haben?', 'verfuegbar.bisGehalt'),

  // ── Block 1: Ausgaben verstehen ─────────────────────────────────────────
  z('Wie viel habe ich letzten Monat insgesamt ausgegeben?', 'ausgaben.gesamt'),
  z('Wofür habe ich letzten Monat am meisten Geld ausgegeben?', 'ausgaben.topKategorien'),
  z('Wie viel habe ich diesen Monat für Lebensmittel ausgegeben?', 'ausgaben.kategorie'),
  z('Wie viel habe ich für Restaurants und Lieferdienste ausgegeben?', 'ausgaben.kategorie'),
  z('Wie viel gebe ich durchschnittlich pro Woche für Essen aus?', 'luecke'),
  z('Wie viel habe ich diesen Monat für Freizeit ausgegeben?', 'ausgaben.kategorie'),
  z('Wie viel habe ich dieses Jahr für Kleidung ausgegeben?', 'ausgaben.kategorie'),
  z('Welche Ausgaben waren diesen Monat ungewöhnlich hoch?', 'ausgaben.ungewoehnlich'),
  z('Wo gebe ich deutlich mehr aus als noch vor einem Jahr?', 'luecke'),
  z('Welche zehn Händler haben dieses Jahr am meisten Geld von mir bekommen?', 'ausgaben.topHaendler'),

  // ── Block 1: Verträge & wiederkehrende Kosten ───────────────────────────
  z('Wie teuer ist mein Internetvertrag?', 'vertrag.jahreskosten'),
  z('Wie viel bezahle ich monatlich für mein Handy?', 'vertrag.jahreskosten'),
  z('Welche Abonnements habe ich aktuell?', 'abos.liste'),
  z('Wie viel kosten mich alle Abonnements zusammen?', 'abos.summe'),
  z('Welche Verträge sind in den letzten zwölf Monaten teurer geworden?', 'vertraege.teurer'),
  z('Welche wiederkehrenden Zahlungen werden nächsten Monat fällig?', 'luecke'),
  z('Welche Verträge nutze ich vermutlich kaum noch?', 'luecke'),
  z('Gibt es Abbuchungen, die wie vergessene Abonnements aussehen?', 'luecke'),
  z('Wie hoch sind meine gesamten Fixkosten pro Monat?', 'fixkosten.monatlich'),
  z('Welcher Anteil meines Einkommens geht jeden Monat für Fixkosten drauf?', 'fixkosten.anteil'),

  // ── Block 1: Auto & Mobilität ───────────────────────────────────────────
  z('Was kostet mich mein Auto wirklich pro Monat?', 'luecke'),
  z('Wie viel habe ich dieses Jahr für Kraftstoff oder Strom ausgegeben?', 'ausgaben.kategorie'),
  z('Wie viel kosten mich Versicherung, Steuer, Werkstatt und Wartung zusammen?', 'ausgaben.kategorie'),
  z('Wie hoch waren meine durchschnittlichen Autokosten der letzten zwölf Monate?', 'luecke'),
  z('Ist mein Auto in diesem Jahr teurer geworden?', 'luecke'),
  z('Wie viel könnte ich sparen, wenn ich mein Auto abschaffe?', 'luecke'),
  z('Wie viel könnte ich sparen, wenn ich häufiger öffentliche Verkehrsmittel nutze?', 'luecke'),
  z('Was kostet mich mein Arbeitsweg durchschnittlich pro Monat?', 'luecke'),
  z('Wie viel müsste ich monatlich für zukünftige Reparaturen am Auto zurücklegen?', 'luecke'),
  z('Kann ich mir ein anderes Auto mit 450 Euro monatlichen Gesamtkosten leisten?', 'leistbarkeit.anschaffung'),

  // ── Block 1: Budgets ────────────────────────────────────────────────────
  z('Wie viel kann ich diesen Monat noch für Lebensmittel ausgeben?', 'budget.rest'),
  z('Wie viel ist noch in meinem Freizeitbudget übrig?', 'budget.rest'),
  z('Wie viel kann ich dieses Wochenende ausgeben, ohne mein Monatsbudget zu überschreiten?', 'budget.tagesrate'),
  z('Welche Budgets werde ich diesen Monat wahrscheinlich überschreiten?', 'budget.status'),
  z('Welche Budgets liegen deutlich unter dem geplanten Verbrauch?', 'budget.status'),
  z('Wie viel kann ich täglich noch ausgeben, damit mein Budget bis Monatsende reicht?', 'budget.tagesrate'),
  z('Wenn ich diesen Monat 100 Euro weniger für Restaurants ausgebe, wie viel mehr kann ich für Freizeit ausgeben?', 'luecke'),
  z('Wenn ich mein Shoppingbudget um 30 Prozent reduziere, wie viel kann ich zusätzlich sparen?', 'luecke'),
  z('Kann ich mein Urlaubsbudget um 200 Euro erhöhen, ohne andere Sparziele zu gefährden?', 'luecke'),
  z('Welches Budget sollte ich reduzieren, wenn ich monatlich zusätzlich 300 Euro sparen möchte?', 'luecke'),

  // ── Block 1: Sparpotenziale ─────────────────────────────────────────────
  z('Wo kann ich aktuell am einfachsten Geld sparen?', 'luecke'),
  z('Welche drei Ausgabenkategorien haben das größte Sparpotenzial?', 'ausgaben.topKategorien'),
  z('Wie viel könnte ich sparen, wenn ich meine Freizeitkosten um 20 Prozent reduziere?', 'luecke'),
  z('Wie viel könnte ich sparen, wenn ich alle nicht benötigten Abonnements kündige?', 'luecke'),
  z('Welche wiederkehrenden Kosten erscheinen im Vergleich zu meinen übrigen Ausgaben besonders hoch?', 'abos.liste'),
  z('Wie viel habe ich in den letzten zwölf Monaten für spontane Käufe ausgegeben?', 'luecke'),
  z('Welche kleinen regelmäßigen Ausgaben summieren sich bei mir besonders stark?', 'luecke'),
  z('Was müsste ich ändern, um jeden Monat 500 Euro mehr übrig zu haben?', 'luecke'),
  z('Wie viel würde ich in einem Jahr sparen, wenn ich meine Lebensmittelkosten um 10 Prozent senke?', 'luecke'),
  z('Wo kann ich sparen, ohne meine Sparziele oder notwendigen Ausgaben anzutasten?', 'luecke'),

  // ── Block 1: Forecast & Zukunft ─────────────────────────────────────────
  z('Wie hoch wird mein Kontostand voraussichtlich am Monatsende sein?', 'forecast.monatsende'),
  z('Wie viel Geld werde ich voraussichtlich in drei Monaten haben?', 'forecast.horizont'),
  z('Wie viel werde ich bis Jahresende sparen können?', 'forecast.horizont'),
  z('Welche größeren Ausgaben kommen in den nächsten 90 Tagen wahrscheinlich auf mich zu?', 'luecke'),
  z('Wann könnte mein Kontostand kritisch niedrig werden?', 'forecast.horizont'),
  z('Wie wahrscheinlich ist es, dass ich nächsten Monat ins Minus rutsche?', 'luecke'),
  z('Wie sieht mein finanzieller Verlauf aus, wenn meine Ausgaben so weiterlaufen wie bisher?', 'forecast.horizont'),
  z('Wie verändert sich mein Forecast, wenn meine Lebensmittelkosten um 15 Prozent steigen?', 'luecke'),
  z('Wie verändert sich mein Forecast, wenn mein Einkommen nächsten Monat um 500 Euro niedriger ausfällt?', 'luecke'),
  z('Wie viel finanziellen Puffer habe ich, wenn mehrere unerwartete Ausgaben gleichzeitig auftreten?', 'luecke'),

  // ── Block 1: Größere Anschaffungen & Ziele ──────────────────────────────
  z('Kann ich mir aktuell einen Urlaub für 5.000 Euro leisten?', 'leistbarkeit.anschaffung'),
  z('Wann kann ich mir einen Urlaub für 5.000 Euro leisten, ohne meinen Notgroschen anzutasten?', 'leistbarkeit.anschaffung'),
  z('Wie viel müsste ich monatlich sparen, damit ich mir in zwölf Monaten ein Auto für 15.000 Euro kaufen kann?', 'luecke'),
  z('Kann ich mir einen neuen Laptop für 2.000 Euro leisten?', 'leistbarkeit.anschaffung'),
  z('Was passiert mit meinen anderen Sparzielen, wenn ich jetzt 2.000 Euro ausgebe?', 'luecke'),
  z('Wie lange dauert es, bis ich 20.000 Euro Eigenkapital angespart habe?', 'luecke'),
  z('Welche monatliche Sparrate brauche ich für 50.000 Euro Eigenkapital in fünf Jahren?', 'luecke'),
  z('Kann ich mir eine monatliche Rate von 800 Euro für eine Immobilie leisten?', 'leistbarkeit.anschaffung'),
  z('Wie teuer dürfte meine nächste Wohnung maximal sein?', 'luecke'),
  z('Was kann ich mir heute leisten, ohne dass die Wahrscheinlichkeit steigt, in den nächsten zwölf Monaten Geldprobleme zu bekommen?', 'leistbarkeit.anschaffung'),

  // ── Block 1: Szenarien & Kombinationen ──────────────────────────────────
  z('Kann ich mir den 5.000-Euro-Urlaub leisten, wenn ich mein Freizeitbudget für sechs Monate um 200 Euro reduziere?', 'leistbarkeit.anschaffung'),
  z('Wann kann ich mir den Urlaub leisten, wenn ich zusätzlich monatlich 300 Euro spare?', 'leistbarkeit.anschaffung'),
  z('Was passiert, wenn mein Gehalt um 10 Prozent steigt, aber meine Miete gleichzeitig um 200 Euro steigt?', 'luecke'),
  z('Wie verändert sich meine finanzielle Situation, wenn ich mein Auto verkaufe und dafür monatlich 100 Euro für ÖPNV ausgebe?', 'luecke'),
  z('Kann ich meine Arbeitszeit reduzieren, ohne meine aktuellen Sparziele aufzugeben?', 'luecke'),
  z('Wie viel weniger dürfte ich verdienen, bevor mein aktueller Lebensstil nicht mehr tragbar wäre?', 'luecke'),
  z('Was passiert mit meinem Vermögen, wenn meine Lebenshaltungskosten jedes Jahr um 3 Prozent steigen?', 'luecke'),
  z('Wie wahrscheinlich ist es laut Monte-Carlo-Simulation, dass ich mein Sparziel bis zum gewünschten Datum erreiche?', 'luecke'),
  // Kurations-Korrektur (WP-F.4): ursprünglich 'luecke' („Immobilienmodell
  // fehlt"), aber die Monte-Carlo-Simulation IST die Funktion, die
  // Leistbarkeits-Wahrscheinlichkeiten rechnet — und der fehlende Betrag
  // erzeugt genau die richtige Rückfrage. Ein Verweis dorthin beantwortet
  // die Frage ehrlicher als ein „verstehe ich nicht".
  z('Mit welcher Wahrscheinlichkeit kann ich mir in drei Jahren eine Immobilie leisten?', 'leistbarkeit.anschaffung'),
  z('Welche Kombination aus höheren Einnahmen und niedrigeren Ausgaben bringt mich am schnellsten zu meinem Ziel?', 'luecke'),

  // ── Block 1: Lebenssituationen & Zielgruppen ────────────────────────────
  z('Als Student: Wie lange reicht mein aktuelles Geld noch, wenn ich keine weiteren Einnahmen bekomme?', 'luecke'),
  z('Als Azubi: Wie viel meines Gehalts kann ich realistisch jeden Monat sparen?', 'luecke'),
  z('Als Familie: Wie viel geben wir monatlich für unsere Kinder aus?', 'ausgaben.kategorie'),
  z('Als Paar: Wer von uns übernimmt aktuell welchen Anteil der gemeinsamen Kosten?', 'luecke'),
  z('Als Familie: Können wir uns Elternzeit mit einem geringeren Einkommen leisten?', 'luecke'),
  z('Als Freelancer: Wie viel Geld sollte ich für Steuern zurücklegen?', 'luecke'),
  z('Als Selbstständiger: Wie hoch sind meine durchschnittlichen monatlichen Betriebsausgaben?', 'luecke'),
  z('Als Freelancer: Wie viele Monate kann ich überbrücken, wenn keine neuen Aufträge kommen?', 'luecke'),
  z('Als Selbstständiger: Wie viel kann ich mir privat auszahlen, ohne meine geschäftliche Liquidität zu gefährden?', 'luecke'),
  z('Als Rentner oder langfristiger Anleger: Wie viel kann ich monatlich aus meinem Vermögen entnehmen, ohne dass mein Geld mit hoher Wahrscheinlichkeit zu früh aufgebraucht ist?', 'luecke'),

  // ── Block 2: 50 kompliziertere Fragen ───────────────────────────────────
  z('Wie viel kann ich diesen Monat noch für Freizeit ausgeben, wenn alle noch ausstehenden Fixkosten berücksichtigt werden?', 'budget.rest'),
  z('Wie viel Geld bleibt mir bis zum nächsten Gehalt übrig, wenn alle erwarteten Abbuchungen wie geplant stattfinden?', 'verfuegbar.bisGehalt'),
  z('Welche meiner Ausgabenkategorien ist im Vergleich zu meinem Durchschnitt der letzten sechs Monate ungewöhnlich hoch?', 'ausgaben.ungewoehnlich'),
  z('Wie viel könnte ich monatlich sparen, wenn ich meine Restaurant-, Lieferdienst- und Freizeitkosten jeweils um 15 Prozent reduziere?', 'luecke'),
  z('Wie hoch sind meine tatsächlichen monatlichen Wohnkosten inklusive Miete, Strom, Internet, Versicherungen und Nebenkosten?', 'ausgaben.kategorie'),
  z('Wie viel kostet mich mein Auto durchschnittlich pro gefahrenem Monat, wenn Versicherung, Kraftstoff, Reparaturen und Wartung berücksichtigt werden?', 'luecke'),
  z('Wie viel günstiger wäre mein Leben ohne Auto, wenn ich stattdessen ein Deutschlandticket und gelegentlich Mietwagen nutze?', 'luecke'),
  z('Welche meiner regelmäßigen Abbuchungen sind in den vergangenen zwölf Monaten teurer geworden?', 'vertraege.teurer'),
  z('Welche wiederkehrenden Zahlungen haben sich möglicherweise verändert, ohne dass ich es bemerkt habe?', 'vertraege.teurer'),
  z('Wie viel meines Einkommens gebe ich durchschnittlich für notwendige und wie viel für freiwillige Ausgaben aus?', 'luecke'),
  z('Wie hoch ist meine tatsächliche Sparquote nach Berücksichtigung unregelmäßiger Jahreskosten?', 'luecke'),
  z('Wie viel sollte ich monatlich zurücklegen, damit jährliche Versicherungen und andere einmalige Rechnungen mich nicht überraschen?', 'luecke'),
  z('Welche Ausgaben müsste ich reduzieren, um meine Sparrate um 300 Euro pro Monat zu erhöhen?', 'luecke'),
  z('Kann ich mein Freizeitbudget erhöhen, wenn ich gleichzeitig mein Restaurantbudget reduziere?', 'luecke'),
  z('Wie viel kann ich dieses Wochenende ausgeben, wenn mein Budget trotzdem bis zum Monatsende reichen soll?', 'budget.tagesrate'),
  z('Wie viel dürfte ich täglich ausgeben, damit ich mein aktuelles Monatsbudget nicht überschreite?', 'budget.tagesrate'),
  z('Welche meiner Budgets werde ich bei meinem aktuellen Ausgabeverhalten wahrscheinlich überschreiten?', 'budget.status'),
  z('Welche Budgets kann ich erhöhen, weil ich andere Kategorien regelmäßig unterschreite?', 'budget.status'),
  z('Wie viel Geld werde ich am Monatsende voraussichtlich übrig haben, wenn meine bisherigen Ausgaben repräsentativ bleiben?', 'forecast.monatsende'),
  z('Wie viel werde ich bis Jahresende voraussichtlich sparen können?', 'forecast.horizont'),
  z('Welche größeren Abbuchungen stehen wahrscheinlich innerhalb der nächsten 60 Tage an?', 'luecke'),
  z('Wie hoch wird mein niedrigster voraussichtlicher Kontostand in den nächsten drei Monaten sein?', 'forecast.horizont'),
  z('Wie viel Puffer brauche ich, damit mein Konto auch bei unerwarteten Ausgaben nicht ins Minus rutscht?', 'luecke'),
  z('Wie wahrscheinlich ist es, dass mein Kontostand innerhalb der nächsten drei Monate unter 1.000 Euro fällt?', 'luecke'),
  z('Kann ich mir einen Urlaub für 3.000 Euro leisten, ohne meinen Notgroschen zu verwenden?', 'leistbarkeit.anschaffung'),
  z('Wann könnte ich mir einen Urlaub für 5.000 Euro leisten, wenn meine aktuelle Sparrate gleich bleibt?', 'leistbarkeit.anschaffung'),
  z('Wie viel müsste ich monatlich zusätzlich sparen, damit ich mein Urlaubsziel sechs Monate früher erreiche?', 'luecke'),
  z('Kann ich mir einen neuen Laptop kaufen und trotzdem mein Sparziel für dieses Jahr erreichen?', 'leistbarkeit.anschaffung'),
  z('Welche meiner Sparziele würden sich verzögern, wenn ich jetzt 2.000 Euro ausgebe?', 'leistbarkeit.anschaffung'),
  z('Wie verändert sich mein Jahresforecast, wenn meine Miete um 150 Euro steigt?', 'luecke'),
  z('Wie verändert sich mein Forecast, wenn mein Nettogehalt ab nächstem Monat 300 Euro höher ist?', 'luecke'),
  z('Wie viel könnte ich zusätzlich sparen, wenn ich meinen Handy-, Internet- und Versicherungsvertrag optimiere?', 'luecke'),
  z('Welche fünf Händler verursachen den größten Anteil meiner freiwilligen Ausgaben?', 'ausgaben.topHaendler'),
  z('Wie viel gebe ich durchschnittlich pro Bestellung bei Lieferdiensten aus und wie hat sich das entwickelt?', 'luecke'),
  z('Welche Ausgaben tätige ich besonders häufig kurz nach meinem Gehaltseingang?', 'luecke'),
  z('Gebe ich in der ersten Monatshälfte mehr aus als in der zweiten?', 'luecke'),
  z('Welche Kategorien steigen besonders stark, wenn mein Einkommen steigt?', 'luecke'),
  z('Wie unterscheiden sich meine Ausgaben an Arbeitstagen und Wochenenden?', 'luecke'),
  z('Wie viel habe ich in den vergangenen zwölf Monaten für Urlaub und Reisen ausgegeben?', 'ausgaben.kategorie'),
  z('Welche Kosten meiner letzten Reise waren geplant und welche ungeplant?', 'luecke'),
  z('Wie viel müsste ich als Freelancer monatlich verdienen, um nach Steuern meine aktuellen privaten Ausgaben decken zu können?', 'luecke'),
  z('Wie viele Monate könnte ich ohne Einkommen von meinen aktuellen Rücklagen leben?', 'luecke'),
  z('Welche Ausgaben müsste ich zuerst reduzieren, wenn mein Einkommen für drei Monate um 30 Prozent sinkt?', 'luecke'),
  z('Wie viel Geld sollte ich als Selbstständiger zusätzlich zu meinem privaten Notgroschen zurücklegen?', 'luecke'),
  z('Wie stark schwanken meine monatlichen Einnahmen und welcher Betrag eignet sich deshalb als realistisches Basisbudget?', 'einkommen.schwankung'),
  z('Welche Monate waren in den letzten zwei Jahren besonders teuer und warum?', 'luecke'),
  z('Welche jährlichen Ausgaben werden bei einer normalen Monatsbetrachtung leicht übersehen?', 'luecke'),
  z('Wie viel meines aktuellen Vermögens ist tatsächlich frei verfügbar und nicht bereits für Ziele oder kommende Rechnungen vorgesehen?', 'luecke'),
  z('Welche meiner finanziellen Ziele konkurrieren momentan um dasselbe Geld?', 'luecke'),
  z('Welches meiner Sparziele sollte ich priorisieren, wenn ich meine aktuelle Liquidität und die jeweiligen Fristen berücksichtige?', 'luecke'),

  // ── Block 2: 50 noch komplexere Fragen ──────────────────────────────────
  z('Kann ich mir einen Urlaub für 5.000 Euro im nächsten Sommer leisten, wenn mein Notgroschen mindestens 10.000 Euro bleiben soll und gleichzeitig 400 Euro monatlich in meine Altersvorsorge fließen?', 'leistbarkeit.anschaffung'),
  z('Wann kann ich mir einen Urlaub für 5.000 Euro mit mindestens 90 Prozent Wahrscheinlichkeit leisten, wenn meine monatlichen Ausgaben ähnlich stark schwanken wie in den letzten zwei Jahren?', 'leistbarkeit.anschaffung'),
  z('Wie hoch darf mein Urlaubsbudget maximal sein, damit mein Kontostand in den darauffolgenden sechs Monaten mit mindestens 95 Prozent Wahrscheinlichkeit nicht unter 3.000 Euro fällt?', 'leistbarkeit.anschaffung'),
  z('Was passiert mit meinem Finanzplan, wenn ich meinen Urlaub dieses Jahr buche, mein Auto nächstes Jahr ersetzen muss und gleichzeitig meine Miete um 10 Prozent steigt?', 'luecke'),
  z('Welche Kombination aus weniger Freizeit-, Restaurant- und Shoppingausgaben würde reichen, um mein Sparziel zwölf Monate früher zu erreichen?', 'luecke'),
  z('Welche Budgetkategorien sollte ich reduzieren, wenn ich 500 Euro zusätzlich sparen möchte, aber meine Lebensqualität möglichst wenig beeinträchtigt werden soll?', 'luecke'),
  z('Wie viel darf ich mein Freizeitbudget erhöhen, wenn ich mein Lebensmittelbudget um 100 Euro und mein Shoppingbudget um 150 Euro reduziere, ohne meine Jahressparrate zu verändern?', 'luecke'),
  z('Wie verändert sich meine Wahrscheinlichkeit, mein Sparziel zu erreichen, wenn ich meine monatliche Sparrate von 500 auf 700 Euro erhöhe?', 'luecke'),
  z('Welche Sparrate benötige ich, damit ich mit 80, 90 und 95 Prozent Wahrscheinlichkeit innerhalb von drei Jahren 30.000 Euro angespart habe?', 'luecke'),
  z('Wie viel früher erreiche ich mein Ziel, wenn ich zusätzlich jeden Bonus vollständig spare?', 'luecke'),
  z('Wie groß ist der Effekt meines Weihnachtsgeldes auf meine langfristige Finanzplanung, wenn ich es entweder ausgebe, spare oder investiere?', 'luecke'),
  z('Wie viel Geld darf ich monatlich zusätzlich ausgeben, wenn mein Gehalt um 500 Euro steigt und ich trotzdem mindestens 70 Prozent der Gehaltserhöhung sparen möchte?', 'luecke'),
  z('Wie verändert sich meine finanzielle Situation über fünf Jahre, wenn mein Gehalt jährlich um 3 Prozent und meine Lebenshaltungskosten um 2,5 Prozent steigen?', 'luecke'),
  z('Wie hoch müsste mein Nettogehalt sein, damit meine aktuelle Lebensweise inklusive Sparziele langfristig tragfähig bleibt?', 'luecke'),
  z('Um wie viel dürfte mein Einkommen sinken, bevor ich mein aktuelles Budget grundsätzlich neu strukturieren müsste?', 'luecke'),
  z('Welche Kosten müsste ich bei einer Einkommensreduzierung zuerst streichen, um meinen Notgroschen möglichst lange nicht anzutasten?', 'luecke'),
  z('Wie lange reicht mein Notgroschen, wenn ich meinen Job verliere und meine Ausgaben nicht sofort vollständig reduzieren kann?', 'luecke'),
  z('Wie lange reicht mein Vermögen bei Arbeitslosigkeit, wenn nach drei Monaten bestimmte freiwillige Ausgaben reduziert werden?', 'luecke'),
  z('Welche finanzielle Strategie schützt mich am besten, wenn meine Einnahmen stark schwanken und größere unregelmäßige Kosten auftreten?', 'luecke'),
  z('Wie groß sollte mein Notgroschen sein, wenn meine tatsächlichen monatlichen Ausgaben, Einkommensschwankungen und möglichen Notfallkosten berücksichtigt werden?', 'luecke'),
  z('Kann ich meinen Notgroschen von sechs auf vier Monatsausgaben reduzieren, ohne mein Gesamtrisiko deutlich zu erhöhen?', 'luecke'),
  z('Wie wahrscheinlich ist es, dass innerhalb der nächsten zwölf Monate mindestens ein Monat mit negativem Cashflow auftritt?', 'luecke'),
  z('In welchen Monaten ist mein finanzielles Risiko aufgrund saisonaler Ausgaben am höchsten?', 'luecke'),
  z('Welche Kombination aus Jahresrechnungen, Urlauben und bekannten Großausgaben könnte meinen Kontostand am stärksten belasten?', 'luecke'),
  z('Wie hoch wäre mein niedrigster Kontostand im schlechtesten realistischen Szenario der nächsten zwölf Monate?', 'luecke'),
  z('Wie unterscheidet sich mein erwarteter Kontostand im optimistischen, realistischen und pessimistischen Szenario?', 'luecke'),
  z('Welche drei Ereignisse haben den größten Einfluss auf die Unsicherheit meines Finanzforecasts?', 'luecke'),
  z('Wie zuverlässig ist mein aktueller Forecast im Vergleich zu den tatsächlichen Ergebnissen der vergangenen zwölf Monate?', 'luecke'),
  z('Welche Ausgabenkategorien lassen sich gut prognostizieren und welche verursachen die größte Forecast-Abweichung?', 'luecke'),
  z('Wie würde sich mein Forecast verändern, wenn unerwartete Ausgaben ähnlich häufig auftreten wie in den vergangenen zwei Jahren?', 'luecke'),
  z('Kann ich mir ein Auto für 30.000 Euro leisten, wenn ich 10.000 Euro anzahle und den Rest finanziere, ohne meine anderen Sparziele wesentlich zu verzögern?', 'leistbarkeit.anschaffung'),
  z('Ist für mich ein günstigeres Auto mit höheren Wartungskosten oder ein teureres Auto mit niedrigeren laufenden Kosten langfristig sinnvoller?', 'luecke'),
  z('Ab welchem monatlichen Gesamtpreis wäre ein Auto für mich finanziell unvernünftig?', 'leistbarkeit.anschaffung'),
  z('Wie verändert sich mein Vermögensaufbau über fünf Jahre, wenn ich auf ein Auto verzichte und die Differenz investiere?', 'luecke'),
  // Kurations-Korrektur (WP-F.4): wie die Wahrscheinlichkeits-Variante oben.
  z('Kann ich mir eine Immobilie leisten, wenn ich mein aktuelles Eigenkapital, meine monatliche Sparrate, Nebenkosten und einen Sicherheitspuffer berücksichtige?', 'leistbarkeit.anschaffung'),
  z('Wann erreiche ich genügend Eigenkapital für eine Immobilie, wenn Immobilienpreise und meine Sparrate gleichzeitig schwanken?', 'luecke'),
  z('Wie teuer dürfte eine Immobilie maximal sein, wenn meine monatliche Gesamtbelastung höchstens 30 Prozent meines Nettoeinkommens betragen soll?', 'luecke'),
  z('Wie verändert sich mein Immobilienbudget, wenn mein Partner für ein Jahr kein Einkommen hat?', 'luecke'),
  z('Kann sich unser Haushalt Elternzeit leisten, wenn ein Einkommen für zwölf Monate deutlich sinkt?', 'luecke'),
  z('Welche Ausgaben müssten wir während der Elternzeit reduzieren, damit unsere Rücklagen nicht unter einen definierten Mindestbetrag fallen?', 'luecke'),
  z('Wie sollten mein Partner und ich gemeinsame Kosten verteilen, wenn unsere Einkommen unterschiedlich hoch sind und beide trotzdem dieselbe persönliche Sparquote erreichen sollen?', 'luecke'),
  z('Wer trägt aktuell welchen Anteil unserer gemeinsamen Ausgaben und wie unterscheidet sich das von unserem Anteil am Haushaltseinkommen?', 'luecke'),
  z('Wie viel kann ich mir als Freelancer monatlich privat auszahlen, wenn Steuern, Umsatzsteuer, Betriebskosten und eine Liquiditätsreserve berücksichtigt werden?', 'luecke'),
  z('Wie viele auftragsfreie Monate kann mein Unternehmen überstehen, ohne dass ich meine private Auszahlung reduzieren muss?', 'luecke'),
  z('Wie hoch müsste mein durchschnittlicher Tagessatz sein, damit ich bei 160 abrechenbaren Tagen mein gewünschtes Nettojahreseinkommen erreiche?', 'luecke'),
  z('Wie viele abrechenbare Tage benötige ich bei meinem aktuellen Tagessatz, um meine privaten und geschäftlichen Ziele zu finanzieren?', 'luecke'),
  z('Sollte ich einen neuen Auftrag annehmen, wenn er zwar zusätzliches Einkommen bringt, aber meine Steuerbelastung und Betriebskosten erhöht?', 'luecke'),
  z('Welche meiner Ausgaben würde FinTrack bei einem plötzlichen Einkommensrückgang automatisch als zuerst reduzierbar einstufen und warum?', 'luecke'),
  z('Welche Änderungen an meinen Budgets hätten laut Simulation den größten positiven Effekt auf mein Vermögen in fünf Jahren?', 'luecke'),
  z('Welche realistische Kombination aus Einkommenserhöhung, Kostenreduktion und Investitionen bringt mich am schnellsten zu meinem Ziel, ohne dass mein monatlicher finanzieller Puffer unter meine Sicherheitsgrenze fällt?', 'luecke'),

  // ── Block 3: 25 Fragen mit kaputter Rechtschreibung ─────────────────────
  z('wann kam mein letzes gehalt eig', 'einkommen.letztes'),
  z('wie hoch war mein gehalt lezten monat', 'einkommen.letztes'),
  z('wurde mein bonnus schon ausgezahlt', 'luecke'),
  z('wieviel hab ich diesen monat noch für essen übrig', 'budget.rest'),
  z('kann ich diesen monat noch 300 euro für freizeit ausgegebn', 'budget.rest'),
  z('was kostet mich mein auto eig im monat alles zusammen', 'luecke'),
  z('wieviel hab ich für tanken versicherung und werkstadt ausgegeben', 'ausgaben.kategorie'),
  z('wo geb ich momentan zuviel geld aus', 'luecke'),
  z('wo kann ich am besten geld einsparren ohne das ich mein budget kaput mache', 'luecke'),
  z('welche verträge sind bei mir unnötig oder zu teuer gewurden', 'vertraege.teurer'),
  z('wieviel geld hab ich noch bis mein nächstes gehalt kommt', 'verfuegbar.bisGehalt'),
  z('reicht mein geld noch bis ende des monats wen alles abgebucht wurde', 'forecast.monatsende'),
  z('kann ich mir urlaub für 5000 leisten oder eher nich', 'leistbarkeit.anschaffung'),
  z('wann könnt ich mir die 5000 für urlaub leisten ohne an notgroschen zu gehn', 'leistbarkeit.anschaffung'),
  z('was wen ich freizeit um 200 reduzier wann kann ich dan in urlaub', 'leistbarkeit.anschaffung'),
  z('wenn ich 100 weniger essen und 100 weniger shopping mach wieviel mehr kann ich sparen', 'luecke'),
  z('kann ich mein freizeit budget erhöhen wen ich weniger für essen ausgebe', 'luecke'),
  z('wie warscheinlich is das ich bis jahresende 10000 gespart hab', 'luecke'),
  z('wieviel geld hab ich ungefähr in 6 monaten wen alles so weiter läuft', 'forecast.horizont'),
  z('was passiert wen nächsten monat 1000 euro extra kosten kommen', 'luecke'),
  z('wie lange komm ich mit mein geld klar wen ich arbeitslos werd', 'luecke'),
  z('kann ich mir ne wohnung für 1200 warm leisten mit mein einkommen', 'leistbarkeit.anschaffung'),
  z('wieviel müsste ich verdiehnen damit ich monatlich 1000 sparen kann', 'luecke'),
  z('was muss ich ändern damit ich in 2 jahren 30000 euro hab', 'luecke'),
  z('zeig mir die beste kombi aus weniger ausgeben mehr sparen und trotzdem noch genug geld zum leben', 'luecke'),
];
