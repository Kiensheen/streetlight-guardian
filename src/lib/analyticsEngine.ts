import { LightStatus } from '@/types/streetlight';

export interface RawReading {
  voltage: number;
  current: number;
  power: number;
  status: LightStatus;
  timestamp: number;
}

export interface WeekSummary {
  streetlightId: string;
  weekKey: string;
  avgVoltage: number;
  minVoltage: number;
  maxVoltage: number;
  avgCurrent: number;
  avgPower: number;
  totalEnergyWh: number;
  uptimePct: number;
  faultCount: number;
  readingCount: number;
}

export interface DailyAggregate {
  day: string; // e.g. "Mon"
  avgVoltage: number;
  totalEnergyWh: number;
}

/**
 * Get ISO week key for a given timestamp, e.g. "2026-W07"
 */
export const getWeekKey = (timestamp: number): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
};

/**
 * Get the Monday and Sunday of a given week key
 */
export const getWeekRange = (weekKey: string): { start: Date; end: Date } => {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay() || 7;
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + (week - 1) * 7 - dayOfWeek + 1);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
};

/**
 * Format a week key for display, e.g. "Week 7 — Feb 10–16, 2026"
 */
export const formatWeekLabel = (weekKey: string): string => {
  const [, weekStr] = weekKey.split('-W');
  const { start, end } = getWeekRange(weekKey);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Week ${parseInt(weekStr)} — ${monthNames[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
};

/**
 * Compute a weekly summary from raw readings for one streetlight
 * Interval is assumed to be 5 seconds → energy per reading = power × (5/3600) Wh
 */
export const computeWeeklySummary = (
  streetlightId: string,
  weekKey: string,
  readings: RawReading[]
): WeekSummary => {
  if (readings.length === 0) {
    return {
      streetlightId,
      weekKey,
      avgVoltage: 0,
      minVoltage: 0,
      maxVoltage: 0,
      avgCurrent: 0,
      avgPower: 0,
      totalEnergyWh: 0,
      uptimePct: 0,
      faultCount: 0,
      readingCount: 0,
    };
  }

  const voltages = readings.map(r => r.voltage).filter(v => v > 0);
  const currents = readings.map(r => r.current).filter(c => c > 0);
  const powers = readings.map(r => r.power);
  const onReadings = readings.filter(r => r.status === 'on' || r.status === 'flickering' || r.status === 'dim');
  const faultReadings = readings.filter(r => r.status === 'off' || r.status === 'flickering');

  // 5-second interval → Wh = power × (5/3600)
  const totalEnergyWh = powers.reduce((sum, p) => sum + p * (5 / 3600), 0);

  return {
    streetlightId,
    weekKey,
    avgVoltage: voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : 0,
    minVoltage: voltages.length > 0 ? Math.min(...voltages) : 0,
    maxVoltage: voltages.length > 0 ? Math.max(...voltages) : 0,
    avgCurrent: currents.length > 0 ? currents.reduce((a, b) => a + b, 0) / currents.length : 0,
    avgPower: powers.length > 0 ? powers.reduce((a, b) => a + b, 0) / powers.length : 0,
    totalEnergyWh,
    uptimePct: readings.length > 0 ? (onReadings.length / readings.length) * 100 : 0,
    faultCount: faultReadings.length,
    readingCount: readings.length,
  };
};

/**
 * Group readings by day of week and compute daily averages
 */
export const computeDailyAggregates = (readings: RawReading[]): DailyAggregate[] => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay: Record<number, RawReading[]> = {};

  readings.forEach(r => {
    const day = new Date(r.timestamp).getDay();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(r);
  });

  // Return Mon–Sun order
  return [1, 2, 3, 4, 5, 6, 0].map(dayIndex => {
    const dayReadings = byDay[dayIndex] || [];
    const voltages = dayReadings.map(r => r.voltage).filter(v => v > 0);
    const powers = dayReadings.map(r => r.power);
    const totalEnergyWh = powers.reduce((sum, p) => sum + p * (5 / 3600), 0);

    return {
      day: dayNames[dayIndex],
      avgVoltage: voltages.length > 0 ? voltages.reduce((a, b) => a + b, 0) / voltages.length : 0,
      totalEnergyWh,
    };
  });
};
