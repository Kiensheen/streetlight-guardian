/// <reference types="@capgo/capacitor-firebase-messaging" />
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.streetlight.guardian',  // ← CHANGE THIS
  appName: 'Streetlight Guardian',
  webDir: 'dist',
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;