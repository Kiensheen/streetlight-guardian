import { getFirebaseDatabase, ref, get, set } from '@/lib/firebase';

const demoStreetlights = {
  'sl-001': {
    name: 'Streetlight 1',
    location: 'Main Street North',
    status: 'on',
    voltage: 225.3,
    current: 0.87,
    power: 196.0,
    timestamp: Date.now(),
  },
  'sl-002': {
    name: 'Streetlight 2',
    location: 'Main Street Center',
    status: 'flickering',
    voltage: 203.5,
    current: 0.65,
    power: 132.3,
    timestamp: Date.now(),
  },
  'sl-003': {
    name: 'Streetlight 3',
    location: 'Main Street South',
    status: 'off',
    voltage: 0,
    current: 0,
    power: 0,
    timestamp: Date.now(),
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
