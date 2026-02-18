import { getFirebaseDatabase, ref, set, push } from '@/lib/database';

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

      // Also push to history log (permanent record)
      push(ref(database, `history/${id}`), {
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        status: data.status,
        timestamp: data.timestamp,
      });
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
    console.log('⏹ Data simulator stopped');
  }
};
