import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, Database } from 'firebase/database';

/**
 * Firebase Configuration for ESP32 IoT Integration
 * 
 * Your ESP32 should write data to Firebase Realtime Database in this structure:
 * 
 * /streetlights
 *   /sl-001
 *     name: "Streetlight 1"
 *     location: "Main Street North"
 *     status: "on" | "off" | "flickering" | "dim"
 *     voltage: 220.5
 *     current: 0.85
 *     power: 187.4      (optional - calculated from V*I if not provided)
 *     timestamp: 1706745600000
 *   /sl-002
 *     ...
 *   /sl-003
 *     ...
 * 
 * ESP32 Arduino example:
 * ```cpp
 * #include <Firebase_ESP_Client.h>
 * 
 * Firebase.RTDB.setFloat(&fbdo, "/streetlights/sl-001/voltage", voltage);
 * Firebase.RTDB.setFloat(&fbdo, "/streetlights/sl-001/current", current);
 * Firebase.RTDB.setFloat(&fbdo, "/streetlights/sl-001/power", voltage * current);
 * Firebase.RTDB.setString(&fbdo, "/streetlights/sl-001/status", "on");
 * Firebase.RTDB.setInt(&fbdo, "/streetlights/sl-001/timestamp", millis());
 * ```
 */

const firebaseConfig = {
  apiKey: import.meta. env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: ReturnType<typeof initializeApp> | null = null;
let database: Database | null = null;

export const initializeFirebase = () => {
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  }
  return { app, database };
};

export const getFirebaseDatabase = () => {
  if (!database) {
    initializeFirebase();
  }
  return database;
};

export { ref, onValue, get };
