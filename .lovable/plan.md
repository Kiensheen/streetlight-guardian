

## Connect App to Firebase Realtime Database

### What will happen
Your app will connect to your Firebase Realtime Database using your config. On first load, it will push demo data to the database so you can see it in your Firebase console. The app will then read live from Firebase instead of using fake local data. Later, when your ESP32 is ready, it will write to the same database paths and the app will automatically show real sensor data.

### Technical Details

**1. Update `src/lib/firebase.ts`**
- Add your full Firebase config including the database URL: `https://streetlight-thesis-default-rtdb.asia-southeast1.firebasedatabase.app/`
- Add Firebase `set` and `push` exports for writing demo data
- Since these are publishable Firebase keys (client-side SDK), storing them in code is safe

**2. Create `src/lib/seedFirebase.ts`**
- A helper function that checks if `/streetlights` data exists in your database
- If empty, it writes the 3 demo streetlights (same mock data currently used) to Firebase
- This runs once on first app load, then never again (since data will already exist)

**3. Update `src/hooks/useStreetlights.ts`**
- Remove the fallback to mock data when Firebase is configured
- Always connect to Firebase since we now have valid credentials
- After connecting, call the seed function if no data exists yet
- Keep the real-time `onValue` listener so the app updates live when data changes

### Data structure in Firebase
```text
/streetlights
  /sl-001
    name: "Streetlight 1"
    location: "Main Street North"
    status: "on"
    voltage: 225.3
    current: 0.87
    power: 196.0
    timestamp: 1739800000000
  /sl-002
    ...
  /sl-003
    ...
```

### What you'll see after this
- The app connects to Firebase and shows "Live" instead of "Demo"
- Opening your Firebase console will show the 3 streetlights with their data
- The mock data auto-updates every 3 seconds, simulating sensor readings being written to Firebase
- When your ESP32 is ready, it writes to these same paths and the app picks it up automatically

