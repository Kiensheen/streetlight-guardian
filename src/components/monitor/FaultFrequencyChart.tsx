 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
 import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
 import { AlertTriangle } from 'lucide-react';
 
 interface FaultFrequencyChartProps {
  data: { week: string; sl1: number; sl2: number }[];
 }
 
 const chartConfig: ChartConfig = {
  sl1: { label: 'Streetlight 1', color: '#2563EB' },
  sl2: { label: 'Streetlight 2', color: '#DC2626' },
 };
 
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
              domain={[0, 1400]}
               tick={{ fontSize: 12 }}
               tickLine={false}
               axisLine={false}
             />
             <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="sl1" radius={[4, 4, 0, 0]} name="Streetlight 1" fill="var(--color-sl1)" />
            <Bar dataKey="sl2" radius={[4, 4, 0, 0]} name="Streetlight 2" fill="var(--color-sl2)" />
           </BarChart>
         </ChartContainer>
       </CardContent>
     </Card>
   );
 };
 
 export default FaultFrequencyChart;