 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
 import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
 import { Zap } from 'lucide-react';
 
 interface VoltageChartProps {
   data: Record<string, string | number>[];
 }
 
 const chartConfig: ChartConfig = {
   sl1: { label: 'Streetlight 1', color: 'hsl(142, 76%, 36%)' },
   sl2: { label: 'Streetlight 2', color: 'hsl(38, 92%, 50%)' },
   sl3: { label: 'Streetlight 3', color: 'hsl(0, 84%, 60%)' },
 };
 
 const VoltageChart: React.FC<VoltageChartProps> = ({ data }) => {
   return (
     <Card className="border-border/50">
       <CardHeader className="pb-2">
         <CardTitle className="text-lg font-semibold flex items-center gap-2">
           <Zap className="h-5 w-5 text-warning" />
           Weekly Voltage Trends
         </CardTitle>
       </CardHeader>
       <CardContent>
         <ChartContainer config={chartConfig} className="h-[280px] w-full">
           <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
             <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
             <XAxis 
               dataKey="day" 
               tick={{ fontSize: 12 }}
               tickLine={false}
               axisLine={false}
             />
             <YAxis 
               domain={[0, 250]}
               tick={{ fontSize: 12 }}
               tickLine={false}
               axisLine={false}
               tickFormatter={(v) => `${v}V`}
             />
             <ChartTooltip content={<ChartTooltipContent />} />
             <Line 
               type="monotone" 
               dataKey="sl1" 
               stroke="var(--color-sl1)" 
               strokeWidth={2}
               dot={false}
               name="Streetlight 1"
             />
             <Line 
               type="monotone" 
               dataKey="sl2" 
               stroke="var(--color-sl2)" 
               strokeWidth={2}
               dot={false}
               name="Streetlight 2"
             />
             <Line 
               type="monotone" 
               dataKey="sl3" 
               stroke="var(--color-sl3)" 
               strokeWidth={2}
               dot={false}
               name="Streetlight 3"
             />
           </LineChart>
         </ChartContainer>
       </CardContent>
     </Card>
   );
 };
 
 export default VoltageChart;