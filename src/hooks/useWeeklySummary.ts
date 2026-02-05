 import { useMemo } from 'react';
 import { Streetlight, Fault, WeeklySummary, LightStatus } from '@/types/streetlight';
 
 // Generate mock weekly data for charts
 const generateWeeklyReadings = (baseValue: number, variance: number, count: number = 168) => {
   const readings: { timestamp: number; value: number }[] = [];
   const now = Date.now();
   const weekMs = 7 * 24 * 60 * 60 * 1000;
   const interval = weekMs / count;
   
   for (let i = 0; i < count; i++) {
     readings.push({
       timestamp: now - weekMs + (i * interval),
       value: baseValue + (Math.random() - 0.5) * variance,
     });
   }
   
   return readings;
 };
 
 const generateTimeline = (status: LightStatus): { timestamp: number; status: LightStatus }[] => {
   const timeline: { timestamp: number; status: LightStatus }[] = [];
   const now = Date.now();
   const weekMs = 7 * 24 * 60 * 60 * 1000;
   const dayMs = 24 * 60 * 60 * 1000;
   
   for (let i = 0; i < 7; i++) {
     const dayStart = now - weekMs + (i * dayMs);
     // Simulate on at night (6PM-6AM)
     timeline.push({ timestamp: dayStart + 18 * 3600000, status: 'on' });
     timeline.push({ timestamp: dayStart + 30 * 3600000, status: 'off' });
   }
   
   return timeline;
 };
 
 export const useWeeklySummary = (streetlights: Streetlight[], faults: Fault[]) => {
   const summaries = useMemo<WeeklySummary[]>(() => {
     const now = Date.now();
     const weekMs = 7 * 24 * 60 * 60 * 1000;
     const weekStart = now - weekMs;
     
     return streetlights.map(sl => {
       const voltageReadings = generateWeeklyReadings(
         sl.status === 'off' ? 0 : 220,
         sl.status === 'off' ? 0 : 15
       );
       const currentReadings = generateWeeklyReadings(
         sl.status === 'off' ? 0 : 0.85,
         sl.status === 'off' ? 0 : 0.3
       );
       const powerReadings = generateWeeklyReadings(
         sl.status === 'off' ? 0 : 185,
         sl.status === 'off' ? 0 : 30
       );
       
       const voltageValues = voltageReadings.map(r => r.value).filter(v => v > 0);
       const currentValues = currentReadings.map(r => r.value).filter(v => v > 0);
       const powerValues = powerReadings.map(r => r.value);
       
       const slFaults = faults.filter(f => f.streetlightId === sl.id);
       
       // Calculate uptime based on status
       let uptimePercentage = 100;
       if (sl.healthStatus === 'fault') {
         uptimePercentage = 20 + Math.random() * 30;
       } else if (sl.healthStatus === 'warning') {
         uptimePercentage = 70 + Math.random() * 20;
       }
       
       return {
         streetlightId: sl.id,
         weekStart,
         weekEnd: now,
         voltageStats: {
           min: voltageValues.length > 0 ? Math.min(...voltageValues) : 0,
           max: voltageValues.length > 0 ? Math.max(...voltageValues) : 0,
           avg: voltageValues.length > 0 ? voltageValues.reduce((a, b) => a + b, 0) / voltageValues.length : 0,
           readings: voltageReadings,
         },
         currentStats: {
           min: currentValues.length > 0 ? Math.min(...currentValues) : 0,
           max: currentValues.length > 0 ? Math.max(...currentValues) : 0,
           avg: currentValues.length > 0 ? currentValues.reduce((a, b) => a + b, 0) / currentValues.length : 0,
           readings: currentReadings,
         },
         powerStats: {
           total: powerValues.reduce((a, b) => a + b, 0),
           avg: powerValues.length > 0 ? powerValues.reduce((a, b) => a + b, 0) / powerValues.length : 0,
           readings: powerReadings,
         },
         faults: slFaults,
         uptimePercentage,
         totalOperationalHours: (uptimePercentage / 100) * 84, // 12 hours/day * 7 days
         timeline: generateTimeline(sl.status),
       };
     });
   }, [streetlights, faults]);
 
   // Aggregate data for charts
   const chartData = useMemo(() => {
     const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
     
     // Voltage trend data
     const voltageData = days.map((day, i) => {
       const data: Record<string, string | number> = { day };
       streetlights.forEach((sl, idx) => {
         const baseVoltage = sl.status === 'off' ? 0 : 215 + Math.random() * 15;
         data[`sl${idx + 1}`] = Number(baseVoltage.toFixed(1));
       });
       return data;
     });
     
     // Power consumption data
     const powerData = days.map((day, i) => {
       const data: Record<string, string | number> = { day };
       let total = 0;
       streetlights.forEach((sl, idx) => {
         const power = sl.status === 'off' ? 0 : 150 + Math.random() * 50;
         data[`sl${idx + 1}`] = Number(power.toFixed(0));
         total += power;
       });
       data.total = Number(total.toFixed(0));
       return data;
     });
     
     // Fault frequency data
     const faultData = [
       { type: 'Light Off', count: faults.filter(f => f.type === 'off_when_scheduled_on').length || 1 },
       { type: 'Flickering', count: faults.filter(f => f.type === 'flickering').length || 1 },
       { type: 'Dim Output', count: faults.filter(f => f.type === 'dim_output').length || 0 },
       { type: 'Voltage', count: faults.filter(f => f.type === 'voltage_anomaly').length || 0 },
     ];
     
     // Uptime data
     const uptimeData = streetlights.map(sl => {
       const summary = summaries.find(s => s.streetlightId === sl.id);
       return {
         name: sl.name,
         uptime: summary?.uptimePercentage || 100,
         downtime: 100 - (summary?.uptimePercentage || 100),
       };
     });
     
     return { voltageData, powerData, faultData, uptimeData };
   }, [streetlights, faults, summaries]);
 
   return { summaries, chartData };
 };