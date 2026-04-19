import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, set, push, Database } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA3-4Q8WusQ8ZiodnOMjZLeuB4Khvvzwjc",
  authDomain: "streetlight-guardian.firebaseapp.com",
  databaseURL: "https://streetlight-thesis-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "streetlight-guardian",
  storageBucket: "streetlight-guardian.firebasestorage.app",
  messagingSenderId: "1074697324873",
  appId: "1:1074697324873:web:6e65d9e39693752d643298",
};

let app: ReturnType<typeof initializeApp> | null = null;
let database: Database | null = null;
let auth: Auth | null = null;
let authPromise: Promise<void> | null = null;

export const initializeFirebase = () => {
  if (!app) {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = getAuth(app);
  }
  return { app, database, auth };
};

export const getFirebaseDatabase = () => {
  if (!database) initializeFirebase();
  return database;
};

export const ensureFirebaseAuth = (): Promise<void> => {
  if (authPromise) return authPromise;
  initializeFirebase();
  authPromise = new Promise<void>((resolve, reject) => {
    if (!auth) return reject(new Error('Auth not initialized'));
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('🔐 Firebase auth ready:', user.uid);
        unsub();
        resolve();
      }
    });
    signInAnonymously(auth).catch((err) => {
      console.error('Anonymous sign-in failed:', err);
      unsub();
      reject(err);
    });
  });
  // Swallow at module level so it can't crash the React render
  authPromise.catch(() => {});
  return authPromise;
};

export { ref, onValue, get, set, push };
