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

  const voltage = isOn || isFlickering
    ? randomBetween(210, 235)
    : isDim
    ? randomBetween(180, 210)
    : 0;

  const current = isOn || isFlickering
    ? randomBetween(0.75, 0.95)
    : isDim
    ? randomBetween(0.4, 0.6)
    : 0;

  const power = Math.round(voltage * current * 100) / 100;

  return { voltage, current, power, status, timestamp: Date.now() };
};

// In-memory daily accumulators
interface DayAccumulator {
  dateKey: string;
  sumVoltage: number;
  sumCurrent: number;
  sumPower: number;
  readingCount: number;
  onCount: number; // on, flickering, dim all count as "operational"
  faultCount: number; // off or flickering
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
  readingCount: 0,
  onCount: 0,
  faultCount: 0,
});

const flushAccumulatorToFirebase = (id: string, acc: DayAccumulator) => {
  const database = getFirebaseDatabase();
  if (!database || acc.readingCount === 0) return;

  const summary = {
    avgVoltage: Math.round((acc.sumVoltage / acc.readingCount) * 100) / 100,
    avgCurrent: Math.round((acc.sumCurrent / acc.readingCount) * 1000) / 1000,
    avgPower: Math.round((acc.sumPower / acc.readingCount) * 100) / 100,
    totalEnergyWh: Math.round((acc.sumPower * 5 / 3600) * 100) / 100, // each reading = 5s interval
    uptimePct: Math.round((acc.onCount / acc.readingCount) * 10000) / 100,
    faultCount: acc.faultCount,
    readingCount: acc.readingCount,
    date: acc.dateKey,
  };

  set(ref(database, `daily_summaries/${id}/${acc.dateKey}`), summary);
};

const updateAccumulator = (id: string, data: ReturnType<typeof getSimulatedLight>) => {
  const dateKey = getDateKey(data.timestamp);
  const key = `${id}_${dateKey}`;

  // If day changed, flush old accumulator
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
  acc.readingCount += 1;

  if (data.status === 'on' || data.status === 'flickering' || data.status === 'dim') {
    acc.onCount += 1;
  }
  const statusStr = data.status as string;
  if (statusStr === 'off' || statusStr === 'flickering') {
    acc.faultCount += 1;
  }

  // Flush current day summary to Firebase every 10 readings (~50s)
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

      // Overwrite current reading (live display)
      set(ref(database, `streetlights/${id}`), {
        name: names[index],
        location: locations[index],
        ...data,
      });

      // Update in-memory accumulator & periodically flush daily summary
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

    // Flush all accumulators on stop
    Object.entries(accumulators).forEach(([key, acc]) => {
      const id = key.split('_')[0];
      flushAccumulatorToFirebase(id, acc);
    });

    console.log('⏹ Data simulator stopped');
  }
};
