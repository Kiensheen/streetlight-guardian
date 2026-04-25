import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History as HistoryIcon, Zap, Sun, Move } from 'lucide-react';
import { getFirebaseDatabase, ref, onValue, ensureFirebaseAuth } from '@/lib/database';

interface HistoryEntry {
  key: string;
  timestampLabel: string;
  timestampMs: number;
  timeMillis: number | null;
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

const estimateTimestampFromLog = (value: Record<string, unknown>, key: string): number => {
  const timeMillis = toFiniteNumber(value.timeMillis);
  if (Number.isFinite(timeMillis) && timeMillis >= 0) {
    return Math.max(0, Date.now() - timeMillis);
  }

  const keyNum = Number(key);
  if (Number.isFinite(keyNum) && keyNum > 0) {
    return keyNum >= 1_000_000_000_000 ? keyNum : keyNum * 1000;
  }

  return Date.now();
};

const HistoryList: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDatabase();
    if (!db) {
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        const r = ref(db, 'sensorLogs');
        unsub = onValue(
          r,
          (snap) => {
            if (!snap.exists()) {
              setEntries([]);
              setLoading(false);
              return;
            }
            const val = snap.val() as Record<string, Record<string, unknown>>;
            const list: HistoryEntry[] = Object.entries(val)
              .map(([key, v]) => {
                const timestampMs = estimateTimestampFromLog(v, key);
                const timeMillis = toFiniteNumber(v.timeMillis);
                return {
                  key,
                  timestampMs,
                  timestampLabel: new Date(timestampMs).toLocaleString(undefined, {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  }),
                  timeMillis: Number.isFinite(timeMillis) ? timeMillis : null,
                  voltage: toFiniteNumber(v.voltage),
                  current: toFiniteNumber(v.current),
                  power: toFiniteNumber(v.power),
                  lux: toFiniteNumber(v.lux),
                  ldr: toFiniteNumber(v.ldr),
                  microwave: toFiniteNumber(v.motion ?? v.microwave),
                };
              })
              .sort((a, b) => b.timestampMs - a.timestampMs)
              .slice(0, 50);
            console.log('[HistoryList] Loaded latest history entries', {
              count: list.length,
              first: list[0],
            });
            setEntries(list);
            setLoading(false);
          },
          (err) => {
            console.error('[HistoryList] Listener error', err);
            setLoading(false);
          }
        );
      })
      .catch((e) => {
        console.error('[HistoryList] Auth failed', e);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HistoryIcon className="h-4 w-4 text-primary" />
          Sensor Logs
          <Badge variant="outline" className="ml-auto text-xs">
            /sensorLogs
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
                    <span>timeMillis: {e.timeMillis ?? '--'}</span>
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
