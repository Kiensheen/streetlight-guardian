import { getFirebaseDatabase, ref, get, set } from '@/lib/database';

const demoStreetlights = {
  'sl-001': {
    name: 'Streetlight 1',
    location: 'Main Street North',
    status: 'on',
    voltage: 13.2,
    current: 2.1,
    power: 27.7,
    timestamp: Date.now(),
    batterySOH: 94,
    luminance: 280,
    motionDetected: false,
    solarChargingCurrent: 0,
  },
  'sl-002': {
    name: 'Streetlight 2',
    location: 'Main Street Center',
    status: 'flickering',
    voltage: 12.5,
    current: 1.4,
    power: 17.5,
    timestamp: Date.now(),
    batterySOH: 88,
    luminance: 120,
    motionDetected: true,
    solarChargingCurrent: 0,
  },
  'sl-003': {
    name: 'Streetlight 3',
    location: 'Main Street South',
    status: 'off',
    voltage: 10.8,
    current: 0,
    power: 0,
    timestamp: Date.now(),
    batterySOH: 65,
    luminance: 2,
    motionDetected: false,
    solarChargingCurrent: 3.2,
  },
};

export const seedFirebaseIfEmpty = async (): Promise<void> => {
  const database = getFirebaseDatabase();
  if (!database) return;

  try {
    const snapshot = await get(ref(database, 'streetlights'));
    if (!snapshot.exists()) {
      await set(ref(database, 'streetlights'), demoStreetlights);
      console.log('Demo streetlight data seeded to Firebase');
    }
  } catch (error) {
    console.error('Failed to seed Firebase:', error);
  }
};
