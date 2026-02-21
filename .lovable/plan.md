

## Replace Sensor History Log with Daily Summary

### What changes

1. **Remove the raw history log component** (`HistoryLog.tsx`) and its import from `Monitor.tsx`
2. **Stop pushing every-5-second readings to Firebase** — the simulator will only update `/streetlights/{id}` (live display) and instead push a **daily summary** to `/daily_summaries/{id}/{dateKey}` once per day (or computed on-the-fly from the current session)
3. **Create a new Daily Summary component** that shows per-day stats (avg voltage, avg current, total energy, uptime %, fault count) in a clean card layout
4. **Update the History tab** to show: Daily Summary cards at the top, then the existing Weekly Analysis below

### Firebase structure change

Stop writing to `/history/{id}` entirely. Instead, store daily summaries:

```text
/daily_summaries
  /{id}              e.g. sl-001
    /2026-02-21
      avgVoltage: 223.4
      avgCurrent: 0.84
      avgPower: 187.6
      totalEnergyWh: 45.2
      uptimePct: 91.5
      faultCount: 2
      readingCount: 480
      date: "2026-02-21"
```

### How daily summaries get created

The simulator will keep a running tally in memory (counts, sums) as it generates readings every 5 seconds. Every time it detects a new day (midnight crossover or first run of the day), it writes the previous day's summary to `/daily_summaries/{id}/{dateKey}` in Firebase. This means no raw data piles up — only one small record per light per day.

### What the History tab will look like

- **Daily Summary section**: A date picker or scrollable list showing the last 7-14 days. Each day shows a card with avg voltage, avg current, total power/energy, uptime %, and fault count for each streetlight.
- **Weekly Analysis section**: Stays exactly as it is, but reads from `/daily_summaries` instead of `/history` — much faster and lighter.

### Technical steps

1. **Update `src/lib/dataSimulator.ts`** — Remove the `push()` call to `/history/{id}`. Add in-memory accumulators and a daily flush that writes to `/daily_summaries/{id}/{dateKey}`
2. **Update `src/lib/analyticsEngine.ts`** — Add a `DailySummary` type and helper functions to work with daily data
3. **Create `src/components/monitor/DailySummary.tsx`** — New component showing daily analysis cards with date navigation
4. **Update `src/components/monitor/WeeklyAnalysis.tsx`** — Read from `/daily_summaries` instead of `/history` for weekly aggregation
5. **Update `src/pages/Monitor.tsx`** — Replace `HistoryLog` import with `DailySummary`
6. **Delete `src/components/monitor/HistoryLog.tsx`** — No longer needed

### Storage impact

- Before: ~52,000 records/day (~5 MB/day)
- After: 3 records/day (one per streetlight, ~1 KB/day)

