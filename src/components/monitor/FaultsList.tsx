 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
 import { Fault, FaultSeverity, FaultType } from '@/types/streetlight';
 import { AlertTriangle, Clock } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface FaultsListProps {
   faults: Fault[];
  onResolveFault?: (faultId: string) => void;
  showResolveAction?: boolean;
 }
 
 const severityConfig: Record<FaultSeverity, { label: string; className: string }> = {
   low: { label: 'Low', className: 'bg-info/10 text-info border-info/20' },
   medium: { label: 'Medium', className: 'bg-warning/10 text-warning border-warning/20' },
   high: { label: 'High', className: 'bg-destructive/10 text-destructive border-destructive/20' },
 };
 
const faultTypeLabels: Record<FaultType, string> = {
  off_when_scheduled_on: 'Light Off',
  flickering: 'Flickering',
  dim_output: 'Dim Output',
  voltage_anomaly: 'Voltage Anomaly',
  low_battery: 'Battery Faulty',
};
 
 const FaultsList: React.FC<FaultsListProps> = ({ faults, onResolveFault, showResolveAction = false }) => {
   const activeFaults = faults.filter(f => !f.resolved);
 
   return (
     <Card className="border-border/50">
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="text-lg font-semibold flex items-center gap-2">
             <AlertTriangle className="h-5 w-5 text-warning" />
             Active Faults
           </CardTitle>
           <Badge variant="secondary" className="font-medium">
             {activeFaults.length} active
           </Badge>
         </div>
       </CardHeader>
       <CardContent>
         {activeFaults.length === 0 ? (
           <div className="py-8 text-center">
             <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
               <AlertTriangle className="h-6 w-6 text-success" />
             </div>
             <p className="text-sm font-medium text-foreground">All systems operational</p>
             <p className="text-xs text-muted-foreground mt-1">No active faults detected</p>
           </div>
         ) : (
           <ScrollArea className="h-[280px] pr-4">
             <div className="space-y-3">
               {activeFaults.map(fault => {
                 const severity = severityConfig[fault.severity];
                 
                 return (
                   <div
                     key={fault.id}
                     className={cn(
                       "p-3 rounded-lg border transition-colors",
                       severity.className
                     )}
                   >
                     <div className="flex items-start justify-between gap-2">
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <span className="font-semibold text-sm truncate">
                             {fault.streetlightName}
                           </span>
                           <Badge variant="outline" className="text-xs shrink-0">
                             {faultTypeLabels[fault.type]}
                           </Badge>
                         </div>
                         <p className="text-xs mt-1 opacity-80 line-clamp-2">
                           {fault.description}
                         </p>
                       </div>
                       <Badge className={cn("shrink-0 text-xs", severity.className)}>
                         {severity.label}
                       </Badge>
                     </div>
                     <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
                       <Clock className="h-3 w-3" />
                       <span>
                        Detected: {fault.detectedAt > 0 ? new Date(fault.detectedAt).toLocaleString() : '--'}
                       </span>
                     </div>
                    {showResolveAction && onResolveFault ? (
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => onResolveFault(fault.id)}
                        >
                          Resolve
                        </Button>
                      </div>
                    ) : null}
                   </div>
                 );
               })}
             </div>
           </ScrollArea>
         )}
       </CardContent>
     </Card>
   );
 };
 
 export default FaultsList;