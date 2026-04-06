 import React, { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Badge } from '@/components/ui/badge';
 import { Notification, FaultType } from '@/types/streetlight';
import { Bell, Check, CheckCheck, Lightbulb, Activity, AlertTriangle, Zap, Battery } from 'lucide-react';
import { cn } from '@/lib/utils';
 
 interface NotificationCenterProps {
   notifications: Notification[];
   unreadCount: number;
   onMarkAsRead: (id: string) => void;
   onMarkAllAsRead: () => void;
 }
 

const faultIcons: Record<FaultType, typeof Lightbulb> = {
  off_when_scheduled_on: Lightbulb,
  flickering: Activity,
  dim_output: Lightbulb,
  voltage_anomaly: Zap,
  low_battery: Battery,
};

const faultTypeLabels: Record<FaultType, string> = {
  off_when_scheduled_on: 'Light Off',
  flickering: 'Flickering',
  dim_output: 'Dim Output',
  voltage_anomaly: 'Voltage Anomaly',
  low_battery: 'Low Battery',
};
 
 const NotificationCenter: React.FC<NotificationCenterProps> = ({
   notifications,
   unreadCount,
   onMarkAsRead,
   onMarkAllAsRead,
 }) => {
   const [isOpen, setIsOpen] = useState(false);
 
   const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);
 
   return (
     <Popover open={isOpen} onOpenChange={setIsOpen}>
       <PopoverTrigger asChild>
         <Button variant="ghost" size="icon" className="relative">
           <Bell className="h-5 w-5 text-muted-foreground" />
           {unreadCount > 0 && (
             <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
               {unreadCount > 9 ? '9+' : unreadCount}
             </span>
           )}
         </Button>
       </PopoverTrigger>
       <PopoverContent align="end" className="w-80 p-0">
         <div className="flex items-center justify-between p-4 border-b border-border">
           <div className="flex items-center gap-2">
             <AlertTriangle className="h-4 w-4 text-warning" />
             <h3 className="font-semibold text-sm">Fault Alerts</h3>
             {unreadCount > 0 && (
               <Badge variant="secondary" className="text-xs">
                 {unreadCount} new
               </Badge>
             )}
           </div>
           {unreadCount > 0 && (
             <Button
               variant="ghost"
               size="sm"
               className="text-xs h-7"
               onClick={onMarkAllAsRead}
             >
               <CheckCheck className="h-3.5 w-3.5 mr-1" />
               Mark all read
             </Button>
           )}
         </div>
         
         {notifications.length === 0 ? (
           <div className="py-12 text-center">
             <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
             <p className="text-sm text-muted-foreground">No notifications</p>
           </div>
         ) : (
           <ScrollArea className="h-[320px]">
             <div className="divide-y divide-border">
               {sortedNotifications.map(notification => {
                 const Icon = faultIcons[notification.faultType];
                 
                 return (
                   <div
                     key={notification.id}
                     className={cn(
                       "p-3 flex gap-3 transition-colors cursor-pointer hover:bg-muted/50",
                       !notification.read && "bg-primary/5"
                     )}
                     onClick={() => onMarkAsRead(notification.id)}
                   >
                     <div className={cn(
                       "shrink-0 p-2 rounded-lg",
                       notification.read ? "bg-muted" : "bg-warning/10"
                     )}>
                       <Icon className={cn(
                         "h-4 w-4",
                         notification.read ? "text-muted-foreground" : "text-warning"
                       )} />
                     </div>
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <span className={cn(
                           "text-sm font-medium truncate",
                           !notification.read && "text-foreground"
                         )}>
                           {notification.streetlightName}
                         </span>
                         {!notification.read && (
                           <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                         )}
                       </div>
                       <p className="text-xs text-muted-foreground mt-0.5">
                         {faultTypeLabels[notification.faultType]} detected
                       </p>
                       <p className="text-xs text-muted-foreground/70 mt-1">
                         {new Date(notification.timestamp).toLocaleString()}
                       </p>
                     </div>
                     {!notification.read && (
                       <Button
                         variant="ghost"
                         size="icon"
                         className="shrink-0 h-6 w-6"
                         onClick={(e) => {
                           e.stopPropagation();
                           onMarkAsRead(notification.id);
                         }}
                       >
                         <Check className="h-3.5 w-3.5" />
                       </Button>
                     )}
                   </div>
                 );
               })}
             </div>
           </ScrollArea>
         )}
       </PopoverContent>
     </Popover>
   );
 };
 
 export default NotificationCenter;