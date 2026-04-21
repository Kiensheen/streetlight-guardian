import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History as HistoryIcon, Zap, Sun, Move } from 'lucide-react';
import { getFirebaseDatabase, ref, onValue, ensureFirebaseAuth } from '@/lib/database';

interface HistoryEntry {
  key: string;
  timestamp: string;
  voltage: number;
  current: number;
  power: number;
  lux: number;
  ldr: number;
  microwave: number;
}

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
        const r = ref(db, 'history');
        unsub = onValue(
          r,
          (snap) => {
            if (!snap.exists()) {
              setEntries([]);
              setLoading(false);
              return;
            }
            const val = snap.val() as Record<string, Omit<HistoryEntry, 'key'>>;
            const list: HistoryEntry[] = Object.entries(val)
              .map(([key, v]) => ({ key, ...v }))
              .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
              .slice(0, 50);
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
          Snapshot History
          <Badge variant="outline" className="ml-auto text-xs">
            Every 60s
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
            No snapshots yet. The first one will appear within a minute.
          </p>
        ) : (
          entries.map((e) => {
            const time = new Date(e.timestamp).toLocaleString();
            return (
              <div
                key={e.key}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{time}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {e.voltage.toFixed(2)}V
                    </span>
                    <span className="flex items-center gap-1">
                      <Sun className="h-3 w-3" />
                      {e.lux.toFixed(0)} lx
                    </span>
                    <span className="flex items-center gap-1">
                      <Move className="h-3 w-3" />
                      {e.microwave === 1 ? 'Yes' : 'No'}
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
