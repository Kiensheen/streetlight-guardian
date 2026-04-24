 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
 import { Clock, TrendingUp } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface UptimeChartProps {
   data: { name: string; uptime: number; downtime: number }[];
 }
 
 const chartConfig: ChartConfig = {
   uptime: { label: 'Uptime', color: 'hsl(142, 76%, 36%)' },
   downtime: { label: 'Downtime', color: 'hsl(0, 84%, 60%)' },
 };
 
 const UptimeChart: React.FC<UptimeChartProps> = ({ data }) => {
   return (
     <Card className="border-border/50">
       <CardHeader className="pb-2">
         <CardTitle className="text-lg font-semibold flex items-center gap-2">
           <Clock className="h-5 w-5 text-info" />
           Uptime / Downtime Report
         </CardTitle>
       </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No uptime data yet — waiting for streetlights to report in.
          </p>
        ) : (
        <div className="space-y-6">
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart 
              data={data} 
              layout="vertical"
              margin={{ top: 10, right: 30, left: 100, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
              <XAxis 
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis 
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="uptime" stackId="a" fill="var(--color-uptime)" name="Uptime %" />
              <Bar dataKey="downtime" stackId="a" fill="var(--color-downtime)" radius={[0, 4, 4, 0]} name="Downtime %" />
            </BarChart>
          </ChartContainer>
          
          <div className={cn(
            "grid gap-4",
            data.length === 1 ? "grid-cols-1" : data.length === 2 ? "grid-cols-2" : "grid-cols-3"
          )}>
            {data.map((item) => (
              <div 
                key={item.name}
                className={cn(
                  "p-3 rounded-lg border border-border/50",
                  item.uptime >= 90 ? "bg-success/5" : item.uptime >= 70 ? "bg-warning/5" : "bg-destructive/5"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
                  <TrendingUp className={cn(
                    "h-3.5 w-3.5",
                    item.uptime >= 90 ? "text-success" : item.uptime >= 70 ? "text-warning" : "text-destructive"
                  )} />
                </div>
                <p className={cn(
                  "text-2xl font-bold",
                  item.uptime >= 90 ? "text-success" : item.uptime >= 70 ? "text-warning" : "text-destructive"
                )}>
                  {item.uptime.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ~{((item.uptime / 100) * 84).toFixed(1)}h operational
                </p>
              </div>
            ))}
          </div>
        </div>
        )}
      </CardContent>
     </Card>
   );
 };
 
 export default UptimeChart;