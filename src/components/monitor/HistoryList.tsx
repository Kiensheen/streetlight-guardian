import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History as HistoryIcon, Zap, Sun, Move } from 'lucide-react';
import { useFirestoreHistory } from '@/hooks/useFirestoreMonitoring';

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

const HistoryList: React.FC = () => {
  const { entries: firestoreEntries, loading } = useFirestoreHistory();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const list: HistoryEntry[] = firestoreEntries.slice(0, 50).map((entry) => ({
      key: entry.id,
      timestampLabel: entry.timestampLabel,
      voltage: toFiniteNumber(entry.voltage),
      current: toFiniteNumber(entry.current),
      power: toFiniteNumber(entry.power),
      lux: toFiniteNumber(entry.lux),
      ldr: toFiniteNumber(entry.ldr),
      microwave: toFiniteNumber(entry.motion ?? entry.microwave),
    }));
    setEntries(list);
  }, [firestoreEntries]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HistoryIcon className="h-4 w-4 text-primary" />
          Sensor Logs
          <Badge variant="outline" className="ml-auto text-xs">
            sensorLogs/Streetlight_1/readings
          </Badge>
        </CardTitle>
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
