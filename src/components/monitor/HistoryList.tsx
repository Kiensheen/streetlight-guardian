import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History as HistoryIcon, Zap, Sun, Move } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StreetlightKey, useFirestoreHistory } from '@/hooks/useFirestoreMonitoring';

interface HistoryEntry {
  key: string;
  timestampLabel: string;
  voltage: number;
  current: number;
  power: number;
  lux: number;
  ldr: number;
  microwave: number;
}

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const pathLabel: Record<StreetlightKey, string> = {
  streetlight_1: 'sensorLogs/Streetlight_1/readings',
  streetlight_2: 'sensorLogs/Streetlight_2/readings',
};

const HistoryList: React.FC = () => {
  const [selectedStreetlight, setSelectedStreetlight] = React.useState<StreetlightKey>('streetlight_1');
  const { entries: firestoreEntries, loading } = useFirestoreHistory(selectedStreetlight);
  const entries = useMemo<HistoryEntry[]>(() => {
    const minuteMap = new Map<string, {
      timestamp: number;
      voltage: number[];
      current: number[];
      power: number[];
      lux: number[];
      ldr: number[];
      motionDetected: boolean;
    }>();

    firestoreEntries.forEach((entry) => {
      if (!entry.rawTime) return;
      const minuteKey = entry.rawTime.slice(0, 14); // MM-DD-YY HH:MM
      const timestamp = entry.timestamp;
      if (!minuteMap.has(minuteKey)) {
        minuteMap.set(minuteKey, {
          timestamp,
          voltage: [],
          current: [],
          power: [],
          lux: [],
          ldr: [],
          motionDetected: false,
        });
      }
      const bucket = minuteMap.get(minuteKey);
      if (!bucket) return;

      const voltage = toFiniteNumber(entry.voltage);
      const current = toFiniteNumber(entry.current);
      const power = toFiniteNumber(entry.power);
      const lux = toFiniteNumber(entry.lux);
      const ldr = toFiniteNumber(entry.ldr);
      const motion = toFiniteNumber(entry.motion ?? entry.microwave);

      if (Number.isFinite(voltage)) bucket.voltage.push(voltage);
      if (Number.isFinite(current)) bucket.current.push(current);
      if (Number.isFinite(power)) bucket.power.push(power);
      if (Number.isFinite(lux)) bucket.lux.push(lux);
      if (Number.isFinite(ldr)) bucket.ldr.push(ldr);
      if (Number.isFinite(motion) && motion === 1) bucket.motionDetected = true;
    });

    const avg = (values: number[]): number =>
      values.length ? values.reduce((s, v) => s + v, 0) / values.length : Number.NaN;

    return Array.from(minuteMap.entries())
      .map(([key, v]) => ({
        key,
        timestampLabel: v.timestamp > 0 ? new Date(v.timestamp).toLocaleString() : '--',
        voltage: avg(v.voltage),
        current: avg(v.current),
        power: avg(v.power),
        lux: avg(v.lux),
        ldr: avg(v.ldr),
        microwave: v.motionDetected ? 1 : 0,
      }))
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, 50);
  }, [firestoreEntries]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HistoryIcon className="h-4 w-4 text-primary" />
          Sensor Logs
          <Badge variant="outline" className="ml-auto text-xs">
            {pathLabel[selectedStreetlight]}
          </Badge>
        </CardTitle>
        <div className="pt-2">
          <Select value={selectedStreetlight} onValueChange={(value) => setSelectedStreetlight(value as StreetlightKey)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select streetlight" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="streetlight_1">Streetlight 1</SelectItem>
              <SelectItem value="streetlight_2">Streetlight 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No sensor logs found yet.
          </p>
        ) : (
          entries.map((e) => {
            return (
              <div
                key={e.key}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{e.timestampLabel}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {Number.isFinite(e.voltage) ? `${e.voltage.toFixed(2)}V` : '--'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Sun className="h-3 w-3" />
                      {Number.isFinite(e.lux) ? `${e.lux.toFixed(0)} lx` : '--'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Move className="h-3 w-3" />
                      {Number.isFinite(e.microwave) ? (e.microwave === 1 ? 'Yes' : 'No') : '--'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default HistoryList;
