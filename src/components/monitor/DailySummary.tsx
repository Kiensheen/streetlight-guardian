import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, CalendarDays, Zap, Activity, Power, AlertTriangle, Clock } from 'lucide-react';
import { getFirebaseDatabase, ref, onValue } from '@/lib/database';
import { Streetlight } from '@/types/streetlight';
import { cn } from '@/lib/utils';

interface DailySummaryData {
  avgVoltage: number;
  avgCurrent: number;
  avgPower: number;
  totalEnergyWh: number;
  uptimePct: number;
  faultCount: number;
  readingCount: number;
  date: string;
}

interface DailySummaryProps {
  streetlights: Streetlight[];
}

const LIGHT_IDS = ['sl-001', 'sl-002', 'sl-003'];

const getDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDateLabel = (dateKey: string): string => {
  const d = new Date(dateKey + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const DailySummary: React.FC<DailySummaryProps> = ({ streetlights }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [summaries, setSummaries] = useState<Record<string, DailySummaryData | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  const dateKey = getDateKey(currentDate);
  const isToday = dateKey === getDateKey(new Date());

  useEffect(() => {
    const database = getFirebaseDatabase();
    if (!database) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribes: (() => void)[] = [];
    const loaded: Record<string, boolean> = {};
    const allData: Record<string, DailySummaryData | null> = {};

    LIGHT_IDS.forEach(id => {
      const summaryRef = ref(database, `daily_summaries/${id}/${dateKey}`);
      const unsub = onValue(summaryRef, (snapshot) => {
        allData[id] = snapshot.exists() ? snapshot.val() : null;
        loaded[id] = true;
        if (LIGHT_IDS.every(lid => loaded[lid])) {
          setSummaries({ ...allData });
          setIsLoading(false);
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  }, [dateKey]);

  const navigateDay = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
      return d;
    });
  };

  const hasData = Object.values(summaries).some(s => s !== null);

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold">{formatDateLabel(dateKey)}</p>
              {isToday && <Badge variant="secondary" className="text-[10px] mt-0.5">Today</Badge>}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDay('next')} disabled={isToday}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      ) : !hasData ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No data for this day</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Daily summaries are generated as the simulator runs
            </p>
          </CardContent>
        </Card>
      ) : (
        LIGHT_IDS.map(id => {
          const summary = summaries[id];
          if (!summary) return null;
          const sl = streetlights.find(s => s.id === id);
          const name = sl?.name || id;

          return (
            <Card key={id} className="border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {summary.readingCount} readings
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {/* Voltage & Current */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <Zap className="h-3 w-3 mx-auto text-warning mb-1" />
                    <p className="text-[10px] text-muted-foreground">Avg Voltage</p>
                    <p className="text-sm font-bold tabular-nums">{summary.avgVoltage.toFixed(1)} V</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <Activity className="h-3 w-3 mx-auto text-info mb-1" />
                    <p className="text-[10px] text-muted-foreground">Avg Current</p>
                    <p className="text-sm font-bold tabular-nums">{summary.avgCurrent.toFixed(3)} A</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <Power className="h-3 w-3 mx-auto text-primary mb-1" />
                    <p className="text-[10px] text-muted-foreground">Avg Power</p>
                    <p className="text-sm font-bold tabular-nums">{summary.avgPower.toFixed(1)} W</p>
                  </div>
                </div>

                {/* Energy & Faults */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-1 mb-1">
                      <Power className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-muted-foreground">Total Energy</span>
                    </div>
                    <p className="text-sm font-bold">
                      {summary.totalEnergyWh.toFixed(1)}
                      <span className="text-[10px] font-normal text-muted-foreground ml-1">Wh</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(summary.totalEnergyWh / 1000).toFixed(3)} kWh
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] text-muted-foreground">Faults</span>
                    </div>
                    <p className={cn('text-sm font-bold', summary.faultCount > 0 ? 'text-destructive' : 'text-success')}>
                      {summary.faultCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">detected</p>
                  </div>
                </div>

                {/* Uptime */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Uptime</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold',
                      summary.uptimePct >= 80 ? 'text-success' :
                      summary.uptimePct >= 50 ? 'text-warning' : 'text-destructive'
                    )}>
                      {summary.uptimePct.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={summary.uptimePct} className="h-2" />
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default DailySummary;
