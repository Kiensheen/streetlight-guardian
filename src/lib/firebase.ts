 import { initializeApp } from 'firebase/app';
 import { getDatabase, ref, onValue, get, Database } from 'firebase/database';
 
 // Firebase configuration - you'll need to add your own config
 const firebaseConfig = {
   apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
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