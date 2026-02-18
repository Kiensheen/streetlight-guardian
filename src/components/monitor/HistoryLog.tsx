import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList, Zap, Activity, Power } from 'lucide-react';
import { getFirebaseDatabase, ref, onValue } from '@/lib/database';
import { Streetlight, LightStatus } from '@/types/streetlight';
import { cn } from '@/lib/utils';

interface RawReading {
  key: string;
  voltage: number;
  current: number;
  power: number;
  status: LightStatus;
  timestamp: number;
}

interface HistoryLogProps {
  streetlights: Streetlight[];
}

const statusColors: Record<LightStatus, string> = {
  on: 'bg-success/10 text-success border-success/20',
  off: 'bg-destructive/10 text-destructive border-destructive/20',
  flickering: 'bg-warning/10 text-warning border-warning/20',
  dim: 'bg-warning/10 text-warning border-warning/20',
};

const HistoryLog: React.FC<HistoryLogProps> = ({ streetlights }) => {
  const [selectedId, setSelectedId] = useState<string>('sl-001');
  const [readings, setReadings] = useState<RawReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const database = getFirebaseDatabase();
    if (!database) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const historyRef = ref(database, `history/${selectedId}`);

    const unsubscribe = onValue(historyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const entries: RawReading[] = Object.entries(data)
          .map(([key, val]: [string, any]) => ({
            key,
            voltage: val.voltage || 0,
            current: val.current || 0,
            power: val.power || 0,
            status: val.status || 'off',
            timestamp: val.timestamp || 0,
          }))
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 100); // show last 100 entries
        setReadings(entries);
      } else {
        setReadings([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedId]);

  const selectedLight = streetlights.find(sl => sl.id === selectedId);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Sensor History Log
          </CardTitle>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {streetlights.map(sl => (
                <SelectItem key={sl.id} value={sl.id} className="text-xs">
                  {sl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedLight && (
          <p className="text-xs text-muted-foreground mt-1">
            {selectedLight.location} — last {readings.length} readings
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : readings.length === 0 ? (
          <div className="py-10 text-center">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No history yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Readings will appear here as the simulator runs
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-2">
            <div className="space-y-2">
              {readings.map((r) => (
                <div
                  key={r.key}
                  className="p-2.5 rounded-lg bg-muted/40 border border-border/30 text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-muted-foreground font-mono">
                      {new Date(r.timestamp).toLocaleTimeString()} · {new Date(r.timestamp).toLocaleDateString()}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] px-1.5 py-0 capitalize', statusColors[r.status])}
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-warning" />
                      <span className="font-semibold tabular-nums">{r.voltage.toFixed(1)}</span>
                      <span className="text-muted-foreground">V</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="h-3 w-3 text-info" />
                      <span className="font-semibold tabular-nums">{r.current.toFixed(2)}</span>
                      <span className="text-muted-foreground">A</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Power className="h-3 w-3 text-primary" />
                      <span className="font-semibold tabular-nums">{r.power.toFixed(0)}</span>
                      <span className="text-muted-foreground">W</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoryLog;
