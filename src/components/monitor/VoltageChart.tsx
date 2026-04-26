import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Zap } from 'lucide-react';
import { VoltageTrendPoint } from '@/hooks/useFirestoreMonitoring';

interface VoltageChartProps {
  dailyData: VoltageTrendPoint[];
  weeklyData: VoltageTrendPoint[];
  monthlyData: VoltageTrendPoint[];
  selectedRange: 'daily' | 'weekly' | 'monthly';
  onRangeChange: (value: 'daily' | 'weekly' | 'monthly') => void;
}

const chartConfig: ChartConfig = {
  sl1: { label: 'Streetlight 1', color: '#2563EB' },
  sl2: { label: 'Streetlight 2', color: '#DC2626' },
};

const VoltageChart: React.FC<VoltageChartProps> = ({
  dailyData,
  weeklyData,
  monthlyData,
  selectedRange,
  onRangeChange,
}) => {
  const data = selectedRange === 'daily'
    ? dailyData
    : selectedRange === 'weekly'
      ? weeklyData
      : monthlyData;
  const title = selectedRange === 'daily'
    ? 'Daily Battery Voltage Trend (24h)'
    : selectedRange === 'weekly'
      ? 'Weekly Battery Voltage Trend (7d)'
      : 'Monthly Battery Voltage Trend (30d)';

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            {title}
          </CardTitle>
          <Tabs value={selectedRange} onValueChange={(v) => onRangeChange(v as 'daily' | 'weekly' | 'monthly')}>
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs px-2">Daily</TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs px-2">Weekly</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs px-2">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[0, 15]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}V`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="sl1" stroke="var(--color-sl1)" strokeWidth={2} dot name="Streetlight 1" />
            <Line type="monotone" dataKey="sl2" stroke="var(--color-sl2)" strokeWidth={2} dot name="Streetlight 2" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default VoltageChart;
