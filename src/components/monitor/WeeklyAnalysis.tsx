import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig
} from '@/components/ui/chart';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, Zap, Power, AlertTriangle, Clock } from 'lucide-react';
import { getFirebaseDatabase, ref, onValue } from '@/lib/database';
import { Streetlight } from '@/types/streetlight';
import {
  RawReading,
  WeekSummary,
  getWeekKey,
  getWeekRange,
  formatWeekLabel,
  computeWeeklySummary,
  computeDailyAggregates,
  DailyAggregate,
} from '@/lib/analyticsEngine';
import { cn } from '@/lib/utils';

interface WeeklyAnalysisProps {
  streetlights: Streetlight[];
}

const LIGHT_IDS = ['sl-001', 'sl-002', 'sl-003'];

const voltageChartConfig: ChartConfig = {
  sl1: { label: 'Streetlight 1', color: 'hsl(142, 76%, 36%)' },
  sl2: { label: 'Streetlight 2', color: 'hsl(38, 92%, 50%)' },
  sl3: { label: 'Streetlight 3', color: 'hsl(0, 84%, 60%)' },
};

const energyChartConfig: ChartConfig = {
  sl1: { label: 'Streetlight 1', color: 'hsl(221, 83%, 53%)' },
  sl2: { label: 'Streetlight 2', color: 'hsl(199, 89%, 48%)' },
  sl3: { label: 'Streetlight 3', color: 'hsl(280, 65%, 60%)' },
};

const WeeklyAnalysis: React.FC<WeeklyAnalysisProps> = ({ streetlights }) => {
  const [currentWeekKey, setCurrentWeekKey] = useState<string>(getWeekKey(Date.now()));
  const [rawHistory, setRawHistory] = useState<Record<string, RawReading[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load daily summaries for all lights for the current week
  useEffect(() => {
    const database = getFirebaseDatabase();
    if (!database) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribes: (() => void)[] = [];
    const loaded: Record<string, boolean> = {};
    const allData: Record<string, RawReading[]> = {};

    LIGHT_IDS.forEach(id => {
      const summariesRef = ref(database, `daily_summaries/${id}`);
      const unsub = onValue(summariesRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          // Convert daily summaries into pseudo-readings for the analytics engine
          allData[id] = Object.entries(data).map(([dateKey, val]: [string, any]) => ({
            voltage: val.avgVoltage || 0,
            current: val.avgCurrent || 0,
            power: val.avgPower || 0,
            status: (val.uptimePct >= 80 ? 'on' : val.uptimePct >= 50 ? 'dim' : 'off') as any,
            timestamp: new Date(dateKey + 'T12:00:00').getTime(),
          }));
        } else {
          allData[id] = [];
        }
        loaded[id] = true;
        if (LIGHT_IDS.every(lid => loaded[lid])) {
          setRawHistory({ ...allData });
          setIsLoading(false);
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(u => u());
  }, []);

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const { start } = getWeekRange(currentWeekKey);
    const newDate = new Date(start);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekKey(getWeekKey(newDate.getTime()));
  };

  const isCurrentWeek = currentWeekKey === getWeekKey(Date.now());

  // Filter readings for current week
  const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekKey);

  const weekReadings: Record<string, RawReading[]> = {};
  LIGHT_IDS.forEach(id => {
    weekReadings[id] = (rawHistory[id] || []).filter(
      r => r.timestamp >= weekStart.getTime() && r.timestamp <= weekEnd.getTime()
    );
  });

  // Compute summaries per light
  const summaries: WeekSummary[] = LIGHT_IDS.map(id =>
    computeWeeklySummary(id, currentWeekKey, weekReadings[id])
  );

  // Daily aggregates for charts (combine all lights)
  const dailyByLight: Record<string, DailyAggregate[]> = {};
  LIGHT_IDS.forEach(id => {
    dailyByLight[id] = computeDailyAggregates(weekReadings[id]);
  });

  // Build chart data arrays
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const voltageChartData = days.map((day, i) => ({
    day,
    sl1: dailyByLight['sl-001']?.[i]?.avgVoltage || 0,
    sl2: dailyByLight['sl-002']?.[i]?.avgVoltage || 0,
    sl3: dailyByLight['sl-003']?.[i]?.avgVoltage || 0,
  }));
  const energyChartData = days.map((day, i) => ({
    day,
    sl1: parseFloat((dailyByLight['sl-001']?.[i]?.totalEnergyWh || 0).toFixed(2)),
    sl2: parseFloat((dailyByLight['sl-002']?.[i]?.totalEnergyWh || 0).toFixed(2)),
    sl3: parseFloat((dailyByLight['sl-003']?.[i]?.totalEnergyWh || 0).toFixed(2)),
  }));

  const hasData = summaries.some(s => s.readingCount > 0);

  return (
    <div className="space-y-4">
      {/* Week Selector */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-semibold">{formatWeekLabel(currentWeekKey)}</p>
              {isCurrentWeek && (
                <Badge variant="secondary" className="text-[10px] mt-0.5">Current Week</Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigateWeek('next')}
              disabled={isCurrentWeek}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : !hasData ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No data for this week yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Data accumulates as the simulator runs
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Per-light summary cards */}
          {summaries.map((summary, i) => {
            const sl = streetlights.find(s => s.id === summary.streetlightId);
            const name = sl?.name || summary.streetlightId;
            const energyKwh = summary.totalEnergyWh / 1000;

            return (
              <Card key={summary.streetlightId} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        summary.uptimePct >= 80 ? 'text-success border-success/30 bg-success/10' :
                        summary.uptimePct >= 50 ? 'text-warning border-warning/30 bg-warning/10' :
                        'text-destructive border-destructive/30 bg-destructive/10'
                      )}
                    >
                      {summary.readingCount} readings
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Voltage stats */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-muted/40 text-center">
                      <Zap className="h-3 w-3 mx-auto text-warning mb-1" />
                      <p className="text-[10px] text-muted-foreground">Avg V</p>
                      <p className="text-sm font-bold tabular-nums">{summary.avgVoltage.toFixed(1)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Min V</p>
                      <p className="text-sm font-bold tabular-nums text-info">{summary.minVoltage.toFixed(1)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">Max V</p>
                      <p className="text-sm font-bold tabular-nums text-success">{summary.maxVoltage.toFixed(1)}</p>
                    </div>
                  </div>

                  {/* Energy & Faults */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-1 mb-1">
                        <Power className="h-3 w-3 text-primary" />
                        <span className="text-[10px] text-muted-foreground">Energy</span>
                      </div>
                      <p className="text-sm font-bold">
                        {summary.totalEnergyWh.toFixed(1)}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">Wh</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {energyKwh.toFixed(3)} kWh
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <span className="text-[10px] text-muted-foreground">Faults</span>
                      </div>
                      <p className="text-sm font-bold text-destructive">{summary.faultCount}</p>
                      <p className="text-[10px] text-muted-foreground">detected</p>
                    </div>
                  </div>

                  {/* Uptime bar */}
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
                    <Progress
                      value={summary.uptimePct}
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Daily Average Voltage Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                Daily Average Voltage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={voltageChartConfig} className="h-[220px] w-full">
                <LineChart data={voltageChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 250]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}V`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="sl1" stroke="var(--color-sl1)" strokeWidth={2} dot={false} name="SL-1" />
                  <Line type="monotone" dataKey="sl2" stroke="var(--color-sl2)" strokeWidth={2} dot={false} name="SL-2" />
                  <Line type="monotone" dataKey="sl3" stroke="var(--color-sl3)" strokeWidth={2} dot={false} name="SL-3" />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Daily Energy Consumption Chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Power className="h-4 w-4 text-primary" />
                Daily Energy Consumption (Wh)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={energyChartConfig} className="h-[220px] w-full">
                <BarChart data={energyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}Wh`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="sl1" fill="var(--color-sl1)" radius={[3, 3, 0, 0]} name="SL-1" />
                  <Bar dataKey="sl2" fill="var(--color-sl2)" radius={[3, 3, 0, 0]} name="SL-2" />
                  <Bar dataKey="sl3" fill="var(--color-sl3)" radius={[3, 3, 0, 0]} name="SL-3" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default WeeklyAnalysis;
