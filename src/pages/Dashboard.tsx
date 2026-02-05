 import React, { useState, useEffect } from 'react';
 import DashboardHeader from '@/components/dashboard/DashboardHeader';
 import StreetlightCard from '@/components/dashboard/StreetlightCard';
 import FaultsList from '@/components/dashboard/FaultsList';
 import VoltageChart from '@/components/dashboard/VoltageChart';
 import PowerChart from '@/components/dashboard/PowerChart';
 import FaultFrequencyChart from '@/components/dashboard/FaultFrequencyChart';
 import UptimeChart from '@/components/dashboard/UptimeChart';
 import { useStreetlights } from '@/hooks/useStreetlights';
 import { useWeeklySummary } from '@/hooks/useWeeklySummary';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Skeleton } from '@/components/ui/skeleton';
 import { Activity, Wifi, WifiOff, LayoutDashboard, BarChart3 } from 'lucide-react';
 
 const Dashboard: React.FC = () => {
   const [isDarkMode, setIsDarkMode] = useState(() => {
     if (typeof window !== 'undefined') {
       return localStorage.getItem('theme') === 'dark' ||
         (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
     }
     return false;
   });
 
   const {
     streetlights,
     faults,
     notifications,
     unreadCount,
     isLoading,
     isFirebaseConnected,
     markNotificationAsRead,
     markAllNotificationsAsRead,
   } = useStreetlights();
 
   const { chartData } = useWeeklySummary(streetlights, faults);
 
   useEffect(() => {
     if (isDarkMode) {
       document.documentElement.classList.add('dark');
       localStorage.setItem('theme', 'dark');
     } else {
       document.documentElement.classList.remove('dark');
       localStorage.setItem('theme', 'light');
     }
   }, [isDarkMode]);
 
   const toggleDarkMode = () => setIsDarkMode(prev => !prev);
 
   if (isLoading) {
     return (
       <div className="min-h-screen bg-background">
         <div className="border-b border-border bg-card p-4">
           <Skeleton className="h-8 w-48" />
         </div>
         <div className="container mx-auto px-4 py-6">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {[1, 2, 3].map(i => (
               <Skeleton key={i} className="h-48 rounded-lg" />
             ))}
           </div>
         </div>
       </div>
     );
   }
 
   const healthySL = streetlights.filter(sl => sl.healthStatus === 'healthy').length;
   const warningSL = streetlights.filter(sl => sl.healthStatus === 'warning').length;
   const faultSL = streetlights.filter(sl => sl.healthStatus === 'fault').length;
 
   return (
     <div className="min-h-screen bg-background">
       <DashboardHeader
         notifications={notifications}
         unreadCount={unreadCount}
         onMarkAsRead={markNotificationAsRead}
         onMarkAllAsRead={markAllNotificationsAsRead}
         isDarkMode={isDarkMode}
         onToggleDarkMode={toggleDarkMode}
       />
       
       <main className="container mx-auto px-4 py-6">
         {/* Connection Status & Overview */}
         <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
           <div className="flex items-center gap-3">
             <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
             <Badge 
               variant="outline" 
               className={isFirebaseConnected 
                 ? "bg-success/10 text-success border-success/20" 
                 : "bg-muted text-muted-foreground"
               }
             >
               {isFirebaseConnected ? (
                 <><Wifi className="h-3 w-3 mr-1" /> Live</>
               ) : (
                 <><WifiOff className="h-3 w-3 mr-1" /> Demo Mode</>
               )}
             </Badge>
           </div>
           
           <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success">
               <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
               <span className="text-sm font-medium">{healthySL} Healthy</span>
             </div>
             {warningSL > 0 && (
               <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 text-warning">
                 <div className="h-2 w-2 rounded-full bg-warning" />
                 <span className="text-sm font-medium">{warningSL} Warning</span>
               </div>
             )}
             {faultSL > 0 && (
               <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive">
                 <div className="h-2 w-2 rounded-full bg-destructive" />
                 <span className="text-sm font-medium">{faultSL} Fault</span>
               </div>
             )}
           </div>
         </div>
 
         <Tabs defaultValue="monitoring" className="space-y-6">
           <TabsList className="bg-muted/50">
             <TabsTrigger value="monitoring" className="gap-2">
               <LayoutDashboard className="h-4 w-4" />
               Real-Time Monitoring
             </TabsTrigger>
             <TabsTrigger value="reports" className="gap-2">
               <BarChart3 className="h-4 w-4" />
               Weekly Reports
             </TabsTrigger>
           </TabsList>
 
           <TabsContent value="monitoring" className="space-y-6">
             {/* Streetlight Cards */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {streetlights.map(streetlight => (
                 <StreetlightCard key={streetlight.id} streetlight={streetlight} />
               ))}
             </div>
             
             {/* Active Faults */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <FaultsList faults={faults} />
               
               <Card className="border-border/50">
                 <CardContent className="p-6">
                   <div className="flex items-center gap-3 mb-4">
                     <Activity className="h-5 w-5 text-primary" />
                     <h3 className="text-lg font-semibold">System Status</h3>
                   </div>
                   <div className="space-y-4">
                     <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                       <span className="text-sm text-muted-foreground">Total Streetlights</span>
                       <span className="text-lg font-bold">{streetlights.length}</span>
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                       <span className="text-sm text-muted-foreground">Active Faults</span>
                       <span className="text-lg font-bold text-destructive">
                         {faults.filter(f => !f.resolved).length}
                       </span>
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                       <span className="text-sm text-muted-foreground">Data Source</span>
                       <span className="text-sm font-medium">
                         {isFirebaseConnected ? 'Firebase Realtime DB' : 'Demo Data'}
                       </span>
                     </div>
                     <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                       <span className="text-sm text-muted-foreground">Last Sync</span>
                       <span className="text-sm font-medium">
                         {new Date().toLocaleTimeString()}
                       </span>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             </div>
           </TabsContent>
 
           <TabsContent value="reports" className="space-y-6">
             {/* Charts Grid */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <VoltageChart data={chartData.voltageData} />
               <PowerChart data={chartData.powerData} />
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <FaultFrequencyChart data={chartData.faultData} />
               <UptimeChart data={chartData.uptimeData} />
             </div>
           </TabsContent>
         </Tabs>
       </main>
     </div>
   );
 };
 
 export default Dashboard;