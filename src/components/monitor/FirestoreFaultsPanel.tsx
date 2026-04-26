import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FirestoreFault,
  FirestoreFaultFilter,
  useFirestoreFaults,
} from '@/hooks/useFirestoreMonitoring';

const filterOptions: { id: FirestoreFaultFilter; label: string }[] = [
  { id: 'all', label: 'Show All' },
  { id: 'unresolved', label: 'Unresolved' },
  { id: 'resolved', label: 'Resolved' },
];

const faultLabel = (type: FirestoreFault['type']): string => {
  if (type === 'LOW_VOLTAGE') return 'Low Voltage';
  if (type === 'BULB_FAILURE') return 'Bulb Failure';
  return 'Low Light Output';
};

const FirestoreFaultsPanel: React.FC = () => {
  const [filter, setFilter] = useState<FirestoreFaultFilter>('all');
  const { faults, loading } = useFirestoreFaults(filter);
  const unresolvedCount = useMemo(
    () => faults.filter((fault) => !fault.resolved).length,
    [faults]
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Firestore Faults
          </CardTitle>
          <Badge variant="outline">{unresolvedCount} unresolved</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant={filter === option.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </>
        ) : faults.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-4">
            No faults in Firestore for this filter.
          </p>
        ) : (
          faults.map((fault) => (
            <div
              key={fault.id}
              className="rounded-lg border border-border/40 bg-muted/30 p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{faultLabel(fault.type)}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {fault.severity}
                  </Badge>
                  <Badge variant={fault.resolved ? 'secondary' : 'destructive'} className="text-[10px]">
                    {fault.resolved ? 'Resolved' : 'Unresolved'}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span>Value: {Number.isFinite(fault.value) ? fault.value : '--'}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fault.timeLabel ?? '--'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default FirestoreFaultsPanel;
