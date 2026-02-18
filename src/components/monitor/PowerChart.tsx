 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
 import { Power } from 'lucide-react';
 
 interface PowerChartProps {
   data: Record<string, string | number>[];
 }
 
 const chartConfig: ChartConfig = {
   sl1: { label: 'Streetlight 1', color: 'hsl(221, 83%, 53%)' },
   sl2: { label: 'Streetlight 2', color: 'hsl(199, 89%, 48%)' },
   sl3: { label: 'Streetlight 3', color: 'hsl(280, 65%, 60%)' },
 };
 
 const PowerChart: React.FC<PowerChartProps> = ({ data }) => {
   return (
     <Card className="border-border/50">
       <CardHeader className="pb-2">
         <CardTitle className="text-lg font-semibold flex items-center gap-2">
           <Power className="h-5 w-5 text-primary" />
           Weekly Power Consumption
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
               tick={{ fontSize: 12 }}
               tickLine={false}
               axisLine={false}
               tickFormatter={(v) => `${v}W`}
             />
             <ChartTooltip content={<ChartTooltipContent />} />
             <Bar dataKey="sl1" fill="var(--color-sl1)" radius={[4, 4, 0, 0]} name="Streetlight 1" />
             <Bar dataKey="sl2" fill="var(--color-sl2)" radius={[4, 4, 0, 0]} name="Streetlight 2" />
             <Bar dataKey="sl3" fill="var(--color-sl3)" radius={[4, 4, 0, 0]} name="Streetlight 3" />
           </BarChart>
         </ChartContainer>
       </CardContent>
     </Card>
   );
 };
 
 export default PowerChart;