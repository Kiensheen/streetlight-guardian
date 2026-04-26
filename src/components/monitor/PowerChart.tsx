import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Power } from 'lucide-react';

interface PowerChartProps {
  data: { day: string; sl1: number; sl2: number }[];
}

const chartConfig: ChartConfig = {
  sl1: { label: 'Streetlight 1', color: '#2563EB' },
  sl2: { label: 'Streetlight 2', color: '#DC2626' },
};

const PowerChart: React.FC<PowerChartProps> = ({ data }) => {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Power className="h-5 w-5 text-primary" />
          Weekly LED Power Consumption
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis 
              dataKey="day" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              domain={[0, 60]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}W`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sl1" fill="var(--color-sl1)" radius={[4, 4, 0, 0]} name="Streetlight 1" />
            <Bar dataKey="sl2" fill="var(--color-sl2)" radius={[4, 4, 0, 0]} name="Streetlight 2" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default PowerChart;
