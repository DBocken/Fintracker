import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import type { Transaction } from '../../types';

interface HeatmapCalendarProps {
  transactions: Transaction[];
}

type Aggregator = 'expenses' | 'income' | 'net' | 'count';

export function HeatmapCalendar({ transactions }: HeatmapCalendarProps) {
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
    if (aggregator === 'count') {
      return `${dateStr}: ${value} Transaktionen`;
    }
    if (aggregator === 'income') {
      return `${dateStr}: ${Math.round(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} Einnahmen`;
    }
    if (aggregator === 'expenses') {
      return `${dateStr}: ${Math.round(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} Ausgaben`;
    }
    // net
    return `${dateStr}: ${Math.round(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} Netto`;
  };

  return (
    <Card className="border-0 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand" />
          Aktivitätskalender
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Steuerung */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-foreground">Zeitraum</div>
            <Select value={String(daysRange)} onValueChange={(v) => setDaysRange(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Letzte 30 Tage</SelectItem>
                <SelectItem value="60">Letzte 60 Tage</SelectItem>
                <SelectItem value="90">Letzte 90 Tage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-foreground">Aggregation</div>
            <Select value={aggregator} onValueChange={(v: Aggregator) => setAggregator(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expenses">Ausgaben</SelectItem>
                <SelectItem value="income">Einnahmen</SelectItem>
                <SelectItem value="net">Netto</SelectItem>
                <SelectItem value="count">Anzahl</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Wochentage */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
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
              className={`aspect-square rounded ${getColorClass(date)} hover:scale-110 transition-transform cursor-pointer`}
              title={formatTitle(date)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}