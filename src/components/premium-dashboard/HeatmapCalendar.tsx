import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import type { Transaction } from '../../types';
import { useI18n } from '@/i18n/useI18n';

interface HeatmapCalendarProps {
  transactions: Transaction[];
}

type Aggregator = 'expenses' | 'income' | 'net' | 'count';

export function HeatmapCalendar({ transactions }: HeatmapCalendarProps) {
  const { t } = useI18n();
  const [daysRange, setDaysRange] = useState<number>(30);
  const [aggregator, setAggregator] = useState<Aggregator>('expenses');

  // Neueste Transaktion als Endpunkt verwenden; wenn keine vorhanden, heute
  const endDate = useMemo(() => {
    if (!transactions.length) return new Date();
    const latest = transactions.reduce((latest, t) => {
      const d = new Date(t.date);
      return d > latest ? d : latest;
    }, new Date(0));
    return latest;
  }, [transactions]);

  // Tageswerte gemäß Aggregator berechnen
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach(t => {
      const key = new Date(t.date).toISOString().split('T')[0];
      const amt = t.amount;
      let value = 0;
      if (aggregator === 'income') value = amt > 0 ? amt : 0;
      else if (aggregator === 'expenses') value = amt < 0 ? Math.abs(amt) : 0;
      else if (aggregator === 'net') value = amt;
      else if (aggregator === 'count') value = 1;
      map.set(key, (map.get(key) || 0) + value);
    });
    return map;
  }, [transactions, aggregator]);

  // Zeitraum: letzte daysRange Tage, endend am neuesten Datum
  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = daysRange - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(d.getDate() - i);
      list.push(d);
    }
    return list;
  }, [endDate, daysRange]);

  // Maximalwert für Farbintensität
  const maxValue = useMemo(() => {
    const vals = days.map(d => activityMap.get(d.toISOString().split('T')[0]) || 0);
    return Math.max(...vals, 0);
  }, [days, activityMap]);

  // Dynamische Farbskalen je Aggregator
  const getColorClass = (date: Date) => {
    const key = date.toISOString().split('T')[0];
    const value = activityMap.get(key) || 0;
    if (maxValue <= 0) return 'bg-muted';

    const ratio = value / maxValue;
    // Diskrete Stufen
    const s1 = ratio < 0.25;
    const s2 = ratio < 0.5;
    const s3 = ratio < 0.75;

    if (aggregator === 'expenses') {
      if (value === 0) return 'bg-muted';
      if (s1) return 'bg-warning';
      if (s2) return 'bg-warning';
      if (s3) return 'bg-warning';
      return 'bg-warning';
    }
    if (aggregator === 'income') {
      if (value === 0) return 'bg-muted';
      if (s1) return 'bg-positive';
      if (s2) return 'bg-positive';
      if (s3) return 'bg-positive';
      return 'bg-positive';
    }
    if (aggregator === 'net') {
      // Netto: negative rot, positive blau
      if (value === 0) return 'bg-muted';
      if (value < 0) {
        const negRatio = Math.abs(value) / (maxValue || 1);
        if (negRatio < 0.25) return 'bg-warning';
        if (negRatio < 0.5) return 'bg-warning';
        if (negRatio < 0.75) return 'bg-warning';
        return 'bg-warning';
      } else {
        if (ratio < 0.25) return 'bg-brand';
        if (ratio < 0.5) return 'bg-brand';
        if (ratio < 0.75) return 'bg-brand';
        return 'bg-brand';
      }
    }
    // count
    if (value === 0) return 'bg-muted';
    if (s1) return 'bg-brand';
    if (s2) return 'bg-brand';
    if (s3) return 'bg-brand';
    return 'bg-brand';
  };

  const formatTitle = (date: Date) => {
    const key = date.toISOString().split('T')[0];
    const value = activityMap.get(key) || 0;
    const dateStr = date.toLocaleDateString('de-DE');
    const amount = Math.round(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    if (aggregator === 'count') {
      return t("premium.heatmap.tooltipCount").replace('{date}', dateStr).replace('{count}', String(value));
    }
    if (aggregator === 'income') {
      return t("premium.heatmap.tooltipIncome").replace('{date}', dateStr).replace('{amount}', amount);
    }
    if (aggregator === 'expenses') {
      return t("premium.heatmap.tooltipExpenses").replace('{date}', dateStr).replace('{amount}', amount);
    }
    // net
    return t("premium.heatmap.tooltipNet").replace('{date}', dateStr).replace('{amount}', amount);
  };

  return (
    // WP-8.1: Karten-los (AGENTS.md Paragraf 9) — die Flaeche traegt einen
    // Regler und eine Heatmap, aber kein Klickversprechen.
    //
    // Nebenbei entfaellt `bg-gradient-to-br from-gray-800 to-gray-900`: Das
    // waren feste Graustufen statt Design-Tokens, im Hellmodus also ein
    // dunkelgrauer Block mitten auf heller Seite.
    <InfoGroup
      title={
        <span className="flex items-center gap-2 text-base text-foreground">
          <Calendar className="h-5 w-5 text-brand" />
          {t("premium.heatmap.title")}
        </span>
      }
    >
      <div>
        {/* Steuerung */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-foreground">{t("premium.heatmap.timeRange")}</div>
            <Select value={String(daysRange)} onValueChange={(v) => setDaysRange(Number(v))}>
              <SelectTrigger className="w-[140px]" aria-label={t("premium.heatmap.timeRange")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t("premium.heatmap.last30Days")}</SelectItem>
                <SelectItem value="60">{t("premium.heatmap.last60Days")}</SelectItem>
                <SelectItem value="90">{t("premium.heatmap.last90Days")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-foreground">{t("premium.heatmap.aggregation")}</div>
            <Select value={aggregator} onValueChange={(v: Aggregator) => setAggregator(v)}>
              <SelectTrigger className="w-[180px]" aria-label={t("premium.heatmap.aggregation")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expenses">{t("premium.heatmap.expenses")}</SelectItem>
                <SelectItem value="income">{t("premium.heatmap.income")}</SelectItem>
                <SelectItem value="net">{t("premium.heatmap.net")}</SelectItem>
                <SelectItem value="count">{t("premium.heatmap.count")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Wochentage */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {[
            t("premium.heatmap.dayMonday"),
            t("premium.heatmap.dayTuesday"),
            t("premium.heatmap.dayWednesday"),
            t("premium.heatmap.dayThursday"),
            t("premium.heatmap.dayFriday"),
            t("premium.heatmap.daySaturday"),
            t("premium.heatmap.daySunday"),
          ].map(day => (
            <div key={day} className="text-xs text-muted-foreground text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => (
            <motion.div
              key={date.toISOString()}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.01, 0.3) }}
              // `cursor-pointer` entfernt: Die Zellen tragen einen Titel zum
              // Ueberfahren, aber keinen Klick. Ein Zeigefinger, der nichts
              // ausloest, ist dieselbe Art falsches Versprechen wie ein toter
              // Karten-Rahmen.
              className={`aspect-square rounded ${getColorClass(date)} transition-transform hover:scale-110`}
              title={formatTitle(date)}
            />
          ))}
        </div>
      </div>
    </InfoGroup>
  );
}