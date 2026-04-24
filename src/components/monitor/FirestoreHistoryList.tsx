import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { History as HistoryIcon, Zap, Sun, Activity } from 'lucide-react';
import { getFirebaseFirestore, ensureFirebaseAuth } from '@/lib/database';
import { collection, onSnapshot, orderBy, query, limit, Timestamp } from 'firebase/firestore';

interface HistoryEntry {
  id: string;
  nodeId: string;
  voltage: number;
  current: number;
  power: number;
  lux: number;
  ldr: number;
  microwave: number;
  ledStatus?: string | null;
  batteryStatus?: string | null;
  soh?: number | null;
  clientTimestamp: number;
  timestamp?: Timestamp;
}

const FirestoreHistoryList: React.FC = () => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>('');

  useEffect(() => {
    const fs = getFirebaseFirestore();
    if (!fs) {
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;
    let cancelled = false;

    ensureFirebaseAuth()
      .then(() => {
        if (cancelled) return;
        const q = query(collection(fs, 'sensor_history'), orderBy('clientTimestamp', 'desc'), limit(100));
        unsub = onSnapshot(
          q,
          (snap) => {
            const list: HistoryEntry[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryEntry, 'id'>) }));
            setEntries(list);
            setLoading(false);
          },
          (err) => {
            console.error('[FirestoreHistoryList] error', err);
            setLoading(false);
          },
        );
      })
      .catch((e) => {
        console.error('[FirestoreHistoryList] auth failed', e);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const filtered = dateFilter
    ? entries.filter((e) => {
        const d = new Date(e.clientTimestamp);
        const iso = d.toISOString().slice(0, 10);
        return iso === dateFilter;
      })
    : entries;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HistoryIcon className="h-4 w-4 text-primary" />
          Sensor History (Firestore)
          <Badge variant="outline" className="ml-auto text-xs">
            Every 60s
          </Badge>
        </CardTitle>
        <div className="pt-2">
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No history entries{dateFilter ? ' for that date' : ' yet. The first one will appear within a minute.'}
          </p>
        ) : (
          filtered.map((e) => {
            const time = new Date(e.clientTimestamp).toLocaleString();
            return (
              <div
                key={e.id}
                className="flex flex-col gap-1.5 p-2.5 rounded-lg bg-muted/40 border border-border/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">{time}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {e.nodeId}
                  </Badge>
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {e.voltage.toFixed(2)}V
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {e.current.toFixed(0)} mA
                  </span>
                  <span className="flex items-center gap-1">
                    <Sun className="h-3 w-3" />
                    {e.lux.toFixed(0)} lx
                  </span>
                  <span>SoH: {e.soh != null ? `${Number(e.soh).toFixed(0)}%` : '--'}</span>
                </div>
                <div className="flex items-center flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    LED: {e.ledStatus ?? '--'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Battery: {e.batteryStatus ?? '--'}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default FirestoreHistoryList;
