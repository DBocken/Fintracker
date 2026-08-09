/**
 * Vertrags-Sheet der Stadt (WP-D4/D5, herausgelöst aus `CityPage.tsx` in
 * WP 6.4).
 *
 * Betrag und Anteile stehen inzwischen an den Labels — das Sheet zeigt
 * stattdessen NEUE Information: die letzten Buchungen des Händlers (kompakt,
 * je Zeile klickbar → exakte Buchung via `?tx=`), einen Preis-Trend-Hinweis
 * und den Deep-Link auf die gefilterte Buchungsseite (gleiches Muster wie
 * Sunburst-/Sankey-Klicks). Die Stadt aggregiert über ALLE geladenen
 * Buchungen; der Default-Range „Gesamt" des Deep-Links deckt sich damit, die
 * Summen bleiben konsistent.
 *
 * Die Inhalte kommen fertig aus `domain/city-contract-sheet.ts` — hier wird
 * nichts mehr abgeleitet.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useI18n } from '@/i18n/useI18n';
import { formatCurrency } from '@/lib/utils';
import { cityDateLocale } from '../domain/city-date-locale';
import type { CityContractSheet as CityContractSheetData } from '../domain/city-contract-sheet';

export type CityContractSheetProps = {
  sheet: CityContractSheetData | null;
  isIncomeWorld: boolean;
  onClose: () => void;
};

export function CityContractSheet({ sheet, isIncomeWorld, onClose }: CityContractSheetProps) {
  const { t, locale } = useI18n();
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(cityDateLocale(locale), { dateStyle: 'medium' }),
    [locale],
  );

  return (
    <Sheet
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="bottom" className="max-h-[70dvh] rounded-t-2xl">
        {sheet && (
          <>
            <SheetHeader>
              <SheetTitle>{sheet.contract.label}</SheetTitle>
              <SheetDescription>
                {t(isIncomeWorld ? 'city.sheetIncomeTitle' : 'city.sheetContractTitle')} · {sheet.district.label} →{' '}
                {sheet.subcategory.label}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">{t('city.sheetMonthlyAmountLabel')}</span>
              <span className="font-semibold">{formatCurrency(sheet.contract.amount)}</span>
            </div>

            {/* Nur bei VERTEUERUNG gegenüber der vorletzten Buchung
                (schleichende Abo-Preiserhöhung). */}
            {sheet.priceIncrease !== null && (
              <p
                data-testid="city-sheet-price-increase"
                className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500"
              >
                <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('city.sheetPriceIncrease').replace('{amount}', formatCurrency(sheet.priceIncrease))}
              </p>
            )}

            {/* WP-D5: nächste erwartete Zahlung des Stroms — nur regelmäßige
                Quellen tragen eine Projektion (Adapter). */}
            {sheet.nextPayment && (
              <p data-testid="city-sheet-next-payment" className="mt-2 text-xs text-muted-foreground">
                {t('city.sheetNextPayment')
                  .replace('{date}', dateFormatter.format(new Date(sheet.nextPayment.dateISO)))
                  .replace('{amount}', formatCurrency(sheet.nextPayment.amount))}
              </p>
            )}

            {sheet.recentBookings.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('city.sheetRecentBookings')}
                </h3>
                <ul className="mt-1">
                  {sheet.recentBookings.map((booking) => (
                    <li key={booking.txId}>
                      {/* Jede Zeile ist als GANZES ein Link auf genau diese
                          Buchung, gefiltert auf Kategorie + Händler, damit die
                          Zielliste kurz ist und die Buchung sicher enthält. */}
                      <Link
                        to={sheet.bookingHref(booking.txId)}
                        data-testid="city-sheet-booking"
                        className="flex min-h-11 items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <span className="text-muted-foreground">{dateFormatter.format(new Date(booking.date))}</span>
                        {/* Zahler nur auf der „Sonstige"-Etage — dort mischen
                            sich mehrere Händler, sonst wäre er redundant zum
                            Sheet-Titel. */}
                        {sheet.isOtherFloor && (
                          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{booking.payee}</span>
                        )}
                        <span className="font-medium tabular-nums">{formatCurrency(booking.amount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <Button asChild variant="outline" className="mt-3 w-full">
                  <Link to={sheet.allBookingsHref} data-testid="city-sheet-all-bookings">
                    {t('city.sheetViewAllBookings').replace('{count}', String(sheet.totalBookings))}
                    <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
