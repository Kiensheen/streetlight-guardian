import { useEffect, useRef } from 'react';
import { Streetlight } from '@/types/streetlight';
import { getFirebaseFirestore, ensureFirebaseAuth } from '@/lib/database';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type FaultKind = 'LOW_VOLTAGE' | 'BULB_FAILURE' | 'LOW_LIGHT_OUTPUT';

const COOLDOWN_MS = 5 * 60 * 1000; // don't re-log same fault more than once per 5 min per node

// Decide if the bulb "should be on" — simple heuristic: it's dark (low ambient lux/high LDR) OR motion detected
const bulbShouldBeOn = (sl: Streetlight): boolean => {
  return sl.luminance < 50 || sl.motionDetected;
};

export const useFaultLogger = (streetlights: Streetlight[]) => {
  // last logged time per `${nodeId}:${kind}`
  const lastLogged = useRef<Record<string, number>>({});

  useEffect(() => {
    const fs = getFirebaseFirestore();
    if (!fs) return;

    const logFault = async (
      sl: Streetlight,
      kind: FaultKind,
      severity: 'low' | 'medium' | 'high',
      value: number,
      threshold: number,
      description: string,
    ) => {
      const key = `${sl.id}:${kind}`;
      const now = Date.now();
      if (lastLogged.current[key] && now - lastLogged.current[key] < COOLDOWN_MS) return;
      lastLogged.current[key] = now;

      try {
        await ensureFirebaseAuth();
        await addDoc(collection(fs, 'faults'), {
          nodeId: sl.id,
          streetlightName: sl.name,
          type: kind,
          severity,
          value,
          threshold,
          description,
          resolved: false,
          timestamp: serverTimestamp(),
          clientTimestamp: now,
        });
        console.log('[FaultLogger] Logged', kind, 'for', sl.id);
      } catch (e) {
        console.error('[FaultLogger] Failed to log fault', e);
      }
    };

    streetlights.forEach((sl) => {
      if (!sl.hasData) return;

      if (sl.voltage > 0 && sl.voltage < 11.5) {
        logFault(sl, 'LOW_VOLTAGE', sl.voltage < 11.0 ? 'high' : 'medium', sl.voltage, 11.5,
          `${sl.name} battery low (${sl.voltage.toFixed(2)}V)`);
      }

      if (bulbShouldBeOn(sl)) {
        if (Math.abs(sl.current) < 50) {
          logFault(sl, 'BULB_FAILURE', 'high', sl.current, 50,
            `${sl.name} bulb appears off (current ${sl.current.toFixed(0)} mA)`);
        }
        if (sl.luminance < 10) {
          logFault(sl, 'LOW_LIGHT_OUTPUT', 'medium', sl.luminance, 10,
            `${sl.name} low light output (${sl.luminance.toFixed(1)} lx)`);
        }
      }
    });
  }, [streetlights]);
};
