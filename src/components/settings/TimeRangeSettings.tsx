"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Clock } from 'lucide-react';

interface TimeRangeSettingsProps {
  retentionMonths: number;
  onRetentionChange: (months: number) => void;
}

export function TimeRangeSettings({ retentionMonths, onRetentionChange }: TimeRangeSettingsProps) {
  const getRetentionLabel = (months: number) => {
    if (months < 12) return `${months} Monate`;
    if (months === 12) return '1 Jahr';
    return `${months / 12} Jahre`;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Aufbewahrungsdauer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Slider
            value={[retentionMonths]}
            onValueChange={([value]: number[]) => onRetentionChange(value)}
            min={1}
            max={120}
            step={1}
          />
          <div className="text-center text-sm text-muted-foreground">
            {getRetentionLabel(retentionMonths)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}