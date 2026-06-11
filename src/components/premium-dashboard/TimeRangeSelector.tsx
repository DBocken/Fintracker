import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TimeRangeSelectorProps {
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
  onExport: () => void;
}

export function TimeRangeSelector({ timeRange, onTimeRangeChange, onExport }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-2">
      <Select value={timeRange} onValueChange={onTimeRangeChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Letzte 7 Tage</SelectItem>
          <SelectItem value="30d">Letzte 30 Tage</SelectItem>
          <SelectItem value="90d">Letzte 90 Tage</SelectItem>
          <SelectItem value="1y">Letztes Jahr</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={onExport}>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    </div>
  );
}