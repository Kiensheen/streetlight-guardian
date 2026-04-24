export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const UNIX_MS_THRESHOLD = 1_000_000_000_000;

export const getRawSensorTimestamp = (value: unknown): unknown => {
  if (!value || typeof value !== 'object') return undefined;

  const record = value as Record<string, unknown>;
  return record.timestamp ?? record.ts ?? record.lastUpdated;
};

export const normalizeSensorTimestamp = (value: unknown): number => {
  const rawTimestamp = getRawSensorTimestamp(value);
  const parsed = Number(rawTimestamp);

  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed >= UNIX_MS_THRESHOLD ? parsed : parsed * 1000;
};

export const getSensorFreshness = (timestampMs: number, now: number = Date.now()) => {
  const hasTimestamp = Number.isFinite(timestampMs) && timestampMs > 0;
  const ageMs = hasTimestamp ? now - timestampMs : Number.POSITIVE_INFINITY;
  const isFresh = hasTimestamp && ageMs >= 0 && ageMs <= ONLINE_WINDOW_MS;

  return {
    hasTimestamp,
    ageMs,
    isFresh,
    isStale: !isFresh,
  };
};