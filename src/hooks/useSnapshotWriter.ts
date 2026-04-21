import { useEffect } from 'react';
import { getFirebaseDatabase, ref, get, set, ensureFirebaseAuth } from '@/lib/database';

// Every 60s, read /sensors and save a snapshot to /history/{timestamp}
export const useSnapshotWriter = () => {
  useEffect(() => {
    const db = getFirebaseDatabase();
    if (!db) return;

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
        const now = new Date();
        const timestamp = now.toISOString().replace(/[.:]/g, '-');
        const entry = {
          timestamp: now.toISOString(),
          voltage: Number(v.voltage ?? 0),
          current: Number(v.current ?? 0),
          power: Number(v.power ?? 0),
          lux: Number(v.lux ?? 0),
          ldr: Number(v.ldr ?? 0),
          microwave: Number(v.microwave ?? 0),
        };
        await set(ref(db, `history/${timestamp}`), entry);
        console.log('[Snapshot] Saved', timestamp, entry);
      } catch (e) {
        console.error('[Snapshot] Failed:', e);
      }
    };

    // Write one immediately, then every 60s
    writeSnapshot();
    const id = setInterval(writeSnapshot, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
};
