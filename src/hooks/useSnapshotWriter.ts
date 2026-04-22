import { useEffect } from 'react';
import { getFirebaseDatabase, ref, get, ensureFirebaseAuth, getFirebaseFirestore } from '@/lib/database';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Every 60s, read /sensors and save a snapshot to Firestore `sensor_history`.
// Non-blocking: errors only logged, never thrown to the UI.
export const useSnapshotWriter = () => {
  useEffect(() => {
    const db = getFirebaseDatabase();
    const fs = getFirebaseFirestore();
    if (!db || !fs) return;

    let cancelled = false;

    const writeSnapshot = async () => {
      try {
        await ensureFirebaseAuth();
        if (cancelled) return;
        const snap = await get(ref(db, 'sensors'));
        if (!snap.exists()) {
          console.log('[Snapshot] /sensors empty, skipping');
          return;
        }
        const v = snap.val() ?? {};
        const entry = {
          nodeId: 'node1',
          voltage: Number(v.voltage ?? 0),
          current: Number(v.current ?? 0),
          power: Number(v.power ?? 0),
          lux: Number(v.lux ?? 0),
          ldr: Number(v.ldr ?? 0),
          microwave: Number(v.microwave ?? 0),
          timestamp: serverTimestamp(),
          clientTimestamp: Date.now(),
        };
        // Fire-and-forget: don't block UI
        addDoc(collection(fs, 'sensor_history'), entry)
          .then(() => console.log('[Snapshot] Saved to Firestore', entry))
          .catch((e) => console.error('[Snapshot] Firestore write failed:', e));
      } catch (e) {
        console.error('[Snapshot] Failed:', e);
      }
    };

    writeSnapshot();
    const id = setInterval(writeSnapshot, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
};
