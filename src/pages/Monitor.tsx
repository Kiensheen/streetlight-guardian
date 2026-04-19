import React, { useState, useEffect } from 'react';
import DashboardHeader from '@/components/monitor/DashboardHeader';
import StreetlightCard from '@/components/monitor/StreetlightCard';
import FaultsList from '@/components/monitor/FaultsList';
import VoltageChart from '@/components/monitor/VoltageChart';
import PowerChart from '@/components/monitor/PowerChart';
import FaultFrequencyChart from '@/components/monitor/FaultFrequencyChart';
import UptimeChart from '@/components/monitor/UptimeChart';
import DailySummary from '@/components/monitor/DailySummary';
import WeeklyAnalysis from '@/components/monitor/WeeklyAnalysis';
import { useSensorData } from '@/hooks/useSensorData';
import { useAnalytics } from '@/hooks/useAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Wifi, WifiOff, LayoutDashboard, BarChart3, History } from 'lucide-react';

const Monitor: React.FC = () => {
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
  } = useSensorData();

  const { chartData } = useAnalytics(streetlights, faults);

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
        <div className="px-4 py-4 space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
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
      
      <main className="px-4 py-4 pb-8 max-w-lg mx-auto">
        {/* Connection Status & Quick Stats */}
        <div className="flex items-center justify-between mb-4">
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
              <><WifiOff className="h-3 w-3 mr-1" /> Demo</>
            )}
          </Badge>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/10 text-success">
              <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium">{healthySL}</span>
            </div>
            {warningSL > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 text-warning">
                <div className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="text-xs font-medium">{warningSL}</span>
              </div>
            )}
            {faultSL > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="text-xs font-medium">{faultSL}</span>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="monitoring" className="space-y-4">
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="monitoring" className="flex-1 gap-1.5 text-xs">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Monitor
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1 gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monitoring" className="space-y-4">
            {/* Streetlight Cards - stacked for mobile */}
            <div className="space-y-3">
              {streetlights.map(streetlight => (
                <StreetlightCard key={streetlight.id} streetlight={streetlight} />
              ))}
            </div>
            
            {/* Active Faults */}
            <FaultsList faults={faults} />
            
            {/* System Status */}
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">System Status</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Total Lights</span>
                    <span className="text-sm font-bold">{streetlights.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Active Faults</span>
                    <span className="text-sm font-bold text-destructive">
                      {faults.filter(f => !f.resolved).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Source</span>
                    <span className="text-xs font-medium">
                      {isFirebaseConnected ? 'ESP32 → Firebase' : 'Demo Data'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-xs text-muted-foreground">Last Sync</span>
                    <span className="text-xs font-medium">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <VoltageChart data={chartData.voltageData} />
            <PowerChart data={chartData.powerData} />
            <FaultFrequencyChart data={chartData.faultData} />
            <UptimeChart data={chartData.uptimeData} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <DailySummary streetlights={streetlights} />
            <WeeklyAnalysis streetlights={streetlights} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Monitor;
