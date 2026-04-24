import { useMemo } from 'react';
import { Streetlight, Fault, WeeklySummary } from '@/types/streetlight';

export const useAnalytics = (streetlights: Streetlight[], faults: Fault[]) => {
  const summaries = useMemo<WeeklySummary[]>(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const weekStart = now - weekMs;

    return streetlights.map(sl => {
      const slFaults = faults.filter(f => f.streetlightId === sl.id);
      const hasFreshData = Boolean(sl.hasData && sl.online);
      const voltage = hasFreshData ? sl.voltage : 0;
      const current = hasFreshData ? sl.current : 0;
      const power = hasFreshData ? sl.power : 0;
      const uptimePercentage = hasFreshData ? 100 : 0;

      return {
        streetlightId: sl.id,
        weekStart,
        weekEnd: now,
        voltageStats: {
          min: voltage,
          max: voltage,
          avg: voltage,
          readings: hasFreshData ? [{ timestamp: sl.lastUpdated, value: voltage }] : [],
        },
        currentStats: {
          min: current,
          max: current,
          avg: current,
          readings: hasFreshData ? [{ timestamp: sl.lastUpdated, value: current }] : [],
        },
        powerStats: {
          total: power,
          avg: power,
          readings: hasFreshData ? [{ timestamp: sl.lastUpdated, value: power }] : [],
        },
        faults: slFaults,
        uptimePercentage,
        totalOperationalHours: hasFreshData ? (weekMs / (60 * 60 * 1000)) : 0,
        timeline: hasFreshData ? [{ timestamp: sl.lastUpdated, status: sl.status }] : [],
      };
    });
  }, [streetlights, faults]);

  const chartData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Until ESP32 history is stored in Firebase, show today's live reading
    // on the last day and zeros on prior days (no fake random values).
    const voltageData = days.map((day, dayIdx) => {
      const data: Record<string, string | number> = { day };
      streetlights.forEach((sl, idx) => {
        data[`sl${idx + 1}`] = dayIdx === days.length - 1 ? Number(sl.voltage.toFixed(2)) : 0;
      });
      return data;
    });

    const powerData = days.map((day, dayIdx) => {
      const data: Record<string, string | number> = { day };
      let total = 0;
      streetlights.forEach((sl, idx) => {
        const p = dayIdx === days.length - 1 ? sl.power : 0;
        data[`sl${idx + 1}`] = Number(p.toFixed(2));
        total += p;
      });
      data.total = Number(total.toFixed(2));
      return data;
    });
    
    const faultData = [
      { type: 'Light Off', count: faults.filter(f => f.type === 'off_when_scheduled_on').length },
      { type: 'Flickering', count: faults.filter(f => f.type === 'flickering').length },
      { type: 'Dim Output', count: faults.filter(f => f.type === 'dim_output').length },
      { type: 'Low Battery', count: faults.filter(f => f.type === 'low_battery').length },
      { type: 'Voltage', count: faults.filter(f => f.type === 'voltage_anomaly').length },
    ];
    
    const uptimeData = streetlights
      .filter(sl => sl.hasData)
      .map(sl => {
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
