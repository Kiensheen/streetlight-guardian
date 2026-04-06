import { getFirebaseDatabase, ref, set } from '@/lib/database';

const statuses = ['on', 'on', 'on', 'flickering', 'dim'] as const;

const randomBetween = (min: number, max: number) =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

const getSimulatedLight = (id: string, index: number) => {
  const statusOptions = index === 0
    ? ['on', 'on', 'on', 'on']
    : index === 1
    ? ['on', 'flickering', 'flickering', 'on']
    : ['off', 'dim', 'on', 'off'];

  const status = statusOptions[Math.floor(Math.random() * statusOptions.length)] as typeof statuses[number];
  const isOn = status === 'on';
  const isDim = status === 'dim';
  const isFlickering = status === 'flickering';

  // 12V LiFePO4 battery: 10.5V (empty) to 14.4V (full charge)
  const voltage = isOn || isFlickering
    ? randomBetween(12.8, 13.6)   // Normal operating range
    : isDim
    ? randomBetween(11.0, 12.0)   // Low battery
    : randomBetween(10.5, 11.5);  // Very low / off

  // LED current: 0-3A
  const current = isOn
    ? randomBetween(1.5, 2.5)
    : isFlickering
    ? randomBetween(0.8, 2.0)
    : isDim
    ? randomBetween(0.3, 0.8)
    : 0;

  // LED power: V * I, max ~50W
  const power = Math.round(voltage * current * 100) / 100;

  // Battery State of Health: 60-100%
  const batterySOH = index === 2
    ? randomBetween(60, 75)   // Aging battery
    : randomBetween(85, 98);  // Good battery

  // BH1750 luminance: high when light is on in dark
  const luminance = isOn
    ? randomBetween(150, 400)  // LED on, measured at ground level
    : isDim
    ? randomBetween(30, 100)
    : isFlickering
    ? randomBetween(50, 300)
    : randomBetween(0, 5);     // Off - ambient only

  // PIR motion detection
  const motionDetected = Math.random() < 0.3; // 30% chance

  // Solar charging current (0 at night when lights are on, simulating daytime residual)
  const solarChargingCurrent = isOn
    ? 0  // Night time, no solar
    : randomBetween(0.5, 4.5); // Daytime charging

  return {
    voltage, current, power, status, timestamp: Date.now(),
    batterySOH, luminance, motionDetected, solarChargingCurrent,
  };
};

// In-memory daily accumulators
interface DayAccumulator {
  dateKey: string;
  sumVoltage: number;
  sumCurrent: number;
  sumPower: number;
  sumBatterySOH: number;
  sumLuminance: number;
  sumSolarCurrent: number;
  readingCount: number;
  onCount: number;
  faultCount: number;
  motionCount: number;
}

const accumulators: Record<string, DayAccumulator> = {};

const getDateKey = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const createEmptyAccumulator = (dateKey: string): DayAccumulator => ({
  dateKey,
  sumVoltage: 0,
  sumCurrent: 0,
  sumPower: 0,
  sumBatterySOH: 0,
  sumLuminance: 0,
  sumSolarCurrent: 0,
  readingCount: 0,
  onCount: 0,
  faultCount: 0,
  motionCount: 0,
});

const flushAccumulatorToFirebase = (id: string, acc: DayAccumulator) => {
  const database = getFirebaseDatabase();
  if (!database || acc.readingCount === 0) return;

  // Realistic nightly energy: ~10-12 hours of operation at ~30W avg = 80-120 Wh
  // Each reading is 5s interval. Scale energy to represent full night operation.
  const avgPower = acc.sumPower / acc.readingCount;
  // Assume 10-12 hours of nightly operation
  const operatingHours = 10 + Math.random() * 2;
  const uptimePct = Math.round((acc.onCount / acc.readingCount) * 10000) / 100;
  const totalEnergyWh = Math.round(avgPower * operatingHours * (uptimePct / 100) * 100) / 100;

  const summary = {
    avgVoltage: Math.round((acc.sumVoltage / acc.readingCount) * 100) / 100,
    avgCurrent: Math.round((acc.sumCurrent / acc.readingCount) * 1000) / 1000,
    avgPower: Math.round((acc.sumPower / acc.readingCount) * 100) / 100,
    totalEnergyWh,
    uptimePct,
    faultCount: acc.faultCount,
    readingCount: acc.readingCount,
    date: acc.dateKey,
    avgBatterySOH: Math.round((acc.sumBatterySOH / acc.readingCount) * 100) / 100,
    avgLuminance: Math.round((acc.sumLuminance / acc.readingCount) * 100) / 100,
    avgSolarCurrent: Math.round((acc.sumSolarCurrent / acc.readingCount) * 1000) / 1000,
    motionEvents: acc.motionCount,
  };

  set(ref(database, `daily_summaries/${id}/${acc.dateKey}`), summary);
};

const updateAccumulator = (id: string, data: ReturnType<typeof getSimulatedLight>) => {
  const dateKey = getDateKey(data.timestamp);
  const key = `${id}_${dateKey}`;

  if (accumulators[key]?.dateKey && accumulators[key].dateKey !== dateKey) {
    flushAccumulatorToFirebase(id, accumulators[key]);
    delete accumulators[key];
  }

  if (!accumulators[key]) {
    accumulators[key] = createEmptyAccumulator(dateKey);
  }

  const acc = accumulators[key];
  acc.sumVoltage += data.voltage;
  acc.sumCurrent += data.current;
  acc.sumPower += data.power;
  acc.sumBatterySOH += data.batterySOH;
  acc.sumLuminance += data.luminance;
  acc.sumSolarCurrent += data.solarChargingCurrent;
  acc.readingCount += 1;

  if (data.status === 'on' || data.status === 'flickering' || data.status === 'dim') {
    acc.onCount += 1;
  }
  const statusStr = data.status as string;
  if (statusStr === 'off' || statusStr === 'flickering') {
    acc.faultCount += 1;
  }
  if (data.motionDetected) {
    acc.motionCount += 1;
  }

  if (acc.readingCount % 10 === 0) {
    flushAccumulatorToFirebase(id, acc);
  }
};

let simulatorInterval: ReturnType<typeof setInterval> | null = null;

export const startSimulator = () => {
  if (simulatorInterval) return;

  const database = getFirebaseDatabase();
  if (!database) return;

  const ids = ['sl-001', 'sl-002', 'sl-003'];
  const names = ['Streetlight 1', 'Streetlight 2', 'Streetlight 3'];
  const locations = ['Main Street North', 'Main Street Center', 'Main Street South'];

  const update = () => {
    ids.forEach((id, index) => {
      const data = getSimulatedLight(id, index);

      set(ref(database, `streetlights/${id}`), {
        name: names[index],
        location: locations[index],
        ...data,
      });

      updateAccumulator(id, data);
    });
  };

  update();
  simulatorInterval = setInterval(update, 5000);
  console.log('🔄 Data simulator started — updating every 5 seconds');
};

export const stopSimulator = () => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;

    Object.entries(accumulators).forEach(([key, acc]) => {
      const id = key.split('_')[0];
      flushAccumulatorToFirebase(id, acc);
    });

    console.log('⏹ Data simulator stopped');
  }
};
