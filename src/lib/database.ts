import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, get, set, push, Database } from 'firebase/database';

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

export const initializeFirebase = () => {
  if (!app) {
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

export { ref, onValue, get, set, push };
