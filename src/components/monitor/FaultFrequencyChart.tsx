 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
 import { AlertTriangle } from 'lucide-react';
 
 interface FaultFrequencyChartProps {
  data: { week: string; count: number }[];
 }
 
 const chartConfig: ChartConfig = {
   count: { label: 'Occurrences', color: 'hsl(0, 84%, 60%)' },
 };
 
 const colors = [
   'hsl(0, 84%, 60%)',
   'hsl(38, 92%, 50%)',
   'hsl(221, 83%, 53%)',
   'hsl(280, 65%, 60%)',
 ];
 
 const FaultFrequencyChart: React.FC<FaultFrequencyChartProps> = ({ data }) => {
   return (
     <Card className="border-border/50">
       <CardHeader className="pb-2">
         <CardTitle className="text-lg font-semibold flex items-center gap-2">
           <AlertTriangle className="h-5 w-5 text-destructive" />
          Weekly Fault Frequency Analysis
         </CardTitle>
       </CardHeader>
       <CardContent>
         <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
             <XAxis 
              dataKey="week"
               tick={{ fontSize: 12 }}
               tickLine={false}
               axisLine={false}
             />
             <YAxis 
              type="number"
               tick={{ fontSize: 12 }}
               tickLine={false}
               axisLine={false}
             />
             <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Occurrences">
               {data.map((entry, index) => (
                 <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
               ))}
             </Bar>
           </BarChart>
         </ChartContainer>
       </CardContent>
     </Card>
   );
 };
 
 export default FaultFrequencyChart;