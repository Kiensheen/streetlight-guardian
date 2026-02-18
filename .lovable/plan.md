
## Smart Solar Streetlight — History Logging, Weekly Analysis & Folder Rename

This plan covers three things: (1) saving real sensor readings to Firebase as history logs, (2) building a history/analysis screen inside the app, and (3) renaming folders and files to remove AI-generated naming.

---

### Part 1 — History Logging to Firebase

Right now the simulator writes data to `/streetlights/{id}` and it gets overwritten every 5 seconds. Nothing is ever saved permanently.

The plan is to also write a snapshot to a separate Firebase path every time a reading comes in, so history is always being built:

```text
/history
  /{id}            e.g. sl-001
    /{timestamp}
      voltage: 225.3
      current: 0.87
      power: 196.0
      status: "on"
      timestamp: 1739800000000
```

Every 5 seconds when the simulator runs, it will push a new record to `/history/{id}` with the current values. This means after one week of running, you will have a full log of every reading — voltage, current, power, and status — for every light.

A weekly aggregator will also run on a schedule. Each day at midnight (or when you open the app), it will compute that week's stats:
- Average, min, max voltage per light
- Total energy consumed (Watt-hours = Power × time)
- Uptime percentage (how many readings had status "on")
- Fault count

These weekly summaries are saved to:

```text
/weekly_summaries
  /{weekKey}       e.g. "2026-W07"
    /{id}
      avgVoltage: 222.1
      minVoltage: 210.5
      maxVoltage: 234.8
      totalEnergyWh: 1240.5
      uptimePct: 94.2
      faultCount: 3
      readingCount: 2016
```

---

### Part 2 — History & Analysis Screen in the App

A new **History** tab will be added to the existing Monitor / Reports tab bar. It will show:

**History Log section** (scrollable list)
- Dropdown to pick which streetlight (All / SL-1 / SL-2 / SL-3)
- Scrollable list of raw readings: time, voltage, current, power, status
- Each entry looks like a log entry with timestamp

**Weekly Analysis section**
- Week selector — arrows to go back/forward through past weeks (e.g. "Week 7, Feb 2026")
- For the selected week, shows a summary card per streetlight with:
  - Average / Min / Max voltage
  - Total energy consumed in Wh and kWh
  - Uptime percentage bar
  - Fault count that week
- A line chart showing daily average voltage for that week
- A bar chart showing daily energy consumption for that week

This screen directly answers your research objectives:
- History logs of current, voltage, power, and energy (Specific Objective 2)
- Data analysis with metrics (Specific Objective 2)
- Fault detection history (Specific Objective 1)

---

### Part 3 — Folder & File Renames

These names will be cleaned up to be professional and research-paper appropriate:

| Old Name | New Name | Why |
|---|---|---|
| `src/lib/seedFirebase.ts` | `src/lib/databaseSeed.ts` | More neutral |
| `src/lib/simulator.ts` | `src/lib/dataSimulator.ts` | Clearer purpose |
| `src/lib/firebase.ts` | `src/lib/database.ts` | Describes what it does |
| `src/hooks/useStreetlights.ts` | `src/hooks/useSensorData.ts` | Matches research terminology |
| `src/hooks/useWeeklySummary.ts` | `src/hooks/useAnalytics.ts` | Matches objective language |
| `src/components/dashboard/` folder | `src/components/monitor/` | Less generic |
| `src/pages/Dashboard.tsx` | `src/pages/Monitor.tsx` | Matches your app's purpose |

All imports will be updated accordingly so nothing breaks.

---

### Technical Implementation Order

1. Update `src/lib/database.ts` — add `push` export from Firebase for writing history records
2. Update `src/lib/dataSimulator.ts` — after each update, also push a record to `/history/{id}`
3. Create `src/lib/analyticsEngine.ts` — functions to compute weekly summaries from raw history data
4. Create `src/hooks/useAnalytics.ts` — hook to read history and weekly summaries from Firebase in real time
5. Create `src/components/monitor/HistoryLog.tsx` — scrollable raw log viewer component
6. Create `src/components/monitor/WeeklyAnalysis.tsx` — week picker + charts + summary cards
7. Update `src/pages/Monitor.tsx` — add the History tab alongside Monitor and Reports
8. Rename all files and update all their imports throughout the codebase

---

### What you will see after this

- The dashboard gets a third tab: **History**
- Raw readings are stored in Firebase continuously — you can see them grow in your Firebase console under `/history`
- Weekly summaries are computed and stored under `/weekly_summaries`
- You can browse past weeks by tapping the left/right arrows on the week selector
- The folder structure no longer has any obvious AI-platform naming — it reads like a proper engineering project
