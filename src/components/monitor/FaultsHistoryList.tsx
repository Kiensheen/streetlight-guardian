import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { getFirebaseFirestore, ensureFirebaseAuth } from '@/lib/database';
import {
  collection, onSnapshot, orderBy, query, limit, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface FaultDoc {
  id: string;
  nodeId: string;
  streetlightName?: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  value: number;
  threshold: number;
  description?: string;
  resolved: boolean;
  clientTimestamp: number;
  timestamp?: Timestamp;
}

type FilterMode = 'all' | 'unresolved' | 'resolved';

const severityClass: Record<FaultDoc['severity'], string> = {
  low: 'bg-info/10 text-info border-info/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

const FaultsHistoryList: React.FC = () => {
  const [faults, setFaults] = useState<FaultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('unresolved');

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
        const q = query(collection(fs, 'faults'), orderBy('clientTimestamp', 'desc'), limit(100));
        unsub = onSnapshot(
          q,
          (snap) => {
            const list: FaultDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FaultDoc, 'id'>) }));
            setFaults(list);
            setLoading(false);
          },
          (err) => {
            console.error('[FaultsHistoryList] error', err);
            setLoading(false);
          },
        );
      })
      .catch((e) => {
        console.error('[FaultsHistoryList] auth failed', e);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  const markResolved = async (id: string) => {
    const fs = getFirebaseFirestore();
    if (!fs) return;
    try {
      await updateDoc(doc(fs, 'faults', id), { resolved: true, resolvedAt: Date.now() });
    } catch (e) {
      console.error('[FaultsHistoryList] resolve failed', e);
    }
  };

  const visible = faults.filter((f) =>
    filter === 'all' ? true : filter === 'resolved' ? f.resolved : !f.resolved,
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Fault Log (Firestore)
          <Badge variant="outline" className="ml-auto text-xs">
            {visible.length}
          </Badge>
        </CardTitle>
        <div className="flex gap-1 pt-2">
          {(['unresolved', 'resolved', 'all'] as FilterMode[]).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={filter === m ? 'default' : 'outline'}
              className="h-7 px-2 text-xs capitalize"
              onClick={() => setFilter(m)}
            >
              {m}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No {filter === 'all' ? '' : filter} faults.
          </p>
        ) : (
          visible.map((f) => {
            const time = new Date(f.clientTimestamp).toLocaleString();
            return (
              <div
                key={f.id}
                className={cn(
                  'p-3 rounded-lg border',
                  f.resolved ? 'bg-muted/30 border-border/40 opacity-70' : severityClass[f.severity],
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.type}</span>
                      <Badge variant="outline" className="text-[10px]">{f.nodeId}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{f.severity}</Badge>
                    </div>
                    {f.description && (
                      <p className="text-xs mt-1 opacity-80">{f.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] opacity-70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {time}
                      </span>
                      <span>value: {f.value.toFixed(2)}</span>
                      <span>threshold: {f.threshold}</span>
                    </div>
                  </div>
                  {!f.resolved ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => markResolved(f.id)}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolve
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-[10px] shrink-0">resolved</Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default FaultsHistoryList;
