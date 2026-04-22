import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, set, push, Database } from 'firebase/database';
import {
  Auth,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBoi1ejuiRUVaqGV8xdHH2utpmy8DXnz7I",
  authDomain: "streetlight-thesis.firebaseapp.com",
  databaseURL: "https://streetlight-thesis-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "streetlight-thesis",
  storageBucket: "streetlight-thesis.firebasestorage.app",
  messagingSenderId: "182498251796",
  appId: "1:182498251796:web:66e52a0f10dbc0473f4301",
};

let app: ReturnType<typeof initializeApp> | null = null;
let database: Database | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let authPromise: Promise<void> | null = null;

export const initializeFirebase = () => {
  if (!app) {
    console.log('[Firebase] Initializing app', {
      databaseURL: firebaseConfig.databaseURL,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
    console.log('[Firebase Auth] Persistence enabled', {
      modes: ['indexedDBLocalPersistence', 'browserLocalPersistence', 'browserSessionPersistence'],
    });
    firestore = getFirestore(app);
  }
  return { app, database, auth, firestore };
};

export const getFirebaseDatabase = () => {
  if (!database) initializeFirebase();
  return database;
};

export const getFirebaseFirestore = () => {
  if (!firestore) initializeFirebase();
  return firestore;
};

export const ensureFirebaseAuth = (): Promise<void> => {
  if (authPromise) return authPromise;
  initializeFirebase();
  authPromise = new Promise<void>((resolve, reject) => {
    if (!auth) return reject(new Error('Auth not initialized'));
    if (auth.currentUser) {
      console.log('[Firebase Auth] Reusing persisted auth session', {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
      });
      resolve();
      return;
    }

    console.log('[Firebase Auth] Restoring auth state...');
    let checkedInitialState = false;

    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          console.log('[Firebase Auth] Anonymous auth ready', { uid: user.uid, isAnonymous: user.isAnonymous });
          unsub();
          resolve();
          return;
        }

        if (checkedInitialState) return;
        checkedInitialState = true;

        try {
          console.log('[Firebase Auth] No saved session, signing in anonymously...');
          await signInAnonymously(auth);
        } catch (err) {
          console.error('[Firebase Auth] Anonymous sign-in failed:', err);
          unsub();
          reject(err);
        }
      },
      (err) => {
        console.error('[Firebase Auth] Auth state listener failed:', err);
        unsub();
        reject(err);
      }
    );
  });
  authPromise.catch(() => {
    authPromise = null;
  });
  return authPromise;
};

export { ref, onValue, get, set, push };
