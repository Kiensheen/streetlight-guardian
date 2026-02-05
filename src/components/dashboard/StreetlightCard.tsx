 import React from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Streetlight, LightStatus, HealthStatus } from '@/types/streetlight';
 import { Lightbulb, Zap, Activity, Power, MapPin } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface StreetlightCardProps {
   streetlight: Streetlight;
 }
 
 const statusConfig: Record<LightStatus, { label: string; className: string; icon: typeof Lightbulb }> = {
   on: { label: 'On', className: 'bg-success text-success-foreground', icon: Lightbulb },
   off: { label: 'Off', className: 'bg-destructive text-destructive-foreground', icon: Lightbulb },
   flickering: { label: 'Flickering', className: 'bg-warning text-warning-foreground', icon: Activity },
   dim: { label: 'Dim', className: 'bg-warning text-warning-foreground', icon: Lightbulb },
 };
 
 const healthConfig: Record<HealthStatus, { color: string; bgColor: string; ringColor: string }> = {
   healthy: { color: 'text-success', bgColor: 'bg-success/10', ringColor: 'ring-success/20' },
   warning: { color: 'text-warning', bgColor: 'bg-warning/10', ringColor: 'ring-warning/20' },
   fault: { color: 'text-destructive', bgColor: 'bg-destructive/10', ringColor: 'ring-destructive/20' },
 };
 
 const StreetlightCard: React.FC<StreetlightCardProps> = ({ streetlight }) => {
   const status = statusConfig[streetlight.status];
   const health = healthConfig[streetlight.healthStatus];
   const StatusIcon = status.icon;
 
   return (
     <Card className={cn(
       "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
       "border-border/50",
       health.ringColor,
       "ring-2 ring-inset"
     )}>
       <div className={cn("absolute top-0 left-0 right-0 h-1", {
         'bg-success': streetlight.healthStatus === 'healthy',
         'bg-warning': streetlight.healthStatus === 'warning',
         'bg-destructive': streetlight.healthStatus === 'fault',
       })} />
       
       <CardHeader className="pb-2">
         <div className="flex items-start justify-between">
           <div className="flex items-center gap-3">
             <div className={cn("p-2.5 rounded-xl", health.bgColor)}>
               <StatusIcon className={cn("h-6 w-6", health.color)} />
             </div>
             <div>
               <CardTitle className="text-lg font-semibold">{streetlight.name}</CardTitle>
               {streetlight.location && (
                 <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                   <MapPin className="h-3 w-3" />
                   {streetlight.location}
                 </div>
               )}
             </div>
           </div>
           <Badge className={cn(status.className, "font-medium")}>
             {status.label}
           </Badge>
         </div>
       </CardHeader>
       
       <CardContent className="space-y-4">
         <div className="grid grid-cols-3 gap-3">
           <div className="space-y-1">
             <div className="flex items-center gap-1.5 text-muted-foreground">
               <Zap className="h-3.5 w-3.5" />
               <span className="text-xs font-medium uppercase tracking-wide">Voltage</span>
             </div>
             <p className="text-xl font-bold tabular-nums">
               {streetlight.voltage.toFixed(1)}
               <span className="text-sm font-normal text-muted-foreground ml-1">V</span>
             </p>
           </div>
           
           <div className="space-y-1">
             <div className="flex items-center gap-1.5 text-muted-foreground">
               <Activity className="h-3.5 w-3.5" />
               <span className="text-xs font-medium uppercase tracking-wide">Current</span>
             </div>
             <p className="text-xl font-bold tabular-nums">
               {streetlight.current.toFixed(2)}
               <span className="text-sm font-normal text-muted-foreground ml-1">A</span>
             </p>
           </div>
           
           <div className="space-y-1">
             <div className="flex items-center gap-1.5 text-muted-foreground">
               <Power className="h-3.5 w-3.5" />
               <span className="text-xs font-medium uppercase tracking-wide">Power</span>
             </div>
             <p className="text-xl font-bold tabular-nums">
               {streetlight.power.toFixed(0)}
               <span className="text-sm font-normal text-muted-foreground ml-1">W</span>
             </p>
           </div>
         </div>
         
         <div className="pt-2 border-t border-border">
           <p className="text-xs text-muted-foreground">
             Last updated: {new Date(streetlight.lastUpdated).toLocaleTimeString()}
           </p>
         </div>
       </CardContent>
     </Card>
   );
 };
 
 export default StreetlightCard;