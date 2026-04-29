type MotionFlag = 0 | 1;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export type Streetlight2Ina219SimulationInput = {
  ldr: number;
  lux: number;
  motion: MotionFlag;
};

export type Streetlight2Ina219SimulationResult = {
  voltage: number; // V
  current: number; // mA
  power: number; // mW
};

// Pure simulation based only on Streetlight 2's own sensor readings.
// Notes:
// - Day/Night is determined by `ldr < 900`.
// - Voltage depends on `lux` (brighter => higher voltage in daytime, lower => lower voltage at night).
// - Current depends on `motion` (microwave == 1 => full brightness, else dim).
export function simulateStreetlight2Ina219({
  ldr,
  lux,
  motion,
}: Streetlight2Ina219SimulationInput): Streetlight2Ina219SimulationResult {
  const isNight = ldr >= 900;
  let voltage: number;
  let current: number;

  if (!isNight) {
    // Daytime: solar charging
    voltage = clamp(13.0 + (lux / 15000), 13.0, 13.8);
    current = 0;
  } else {
    // Nighttime: battery discharging
    // Keep the formula in sync with the rules provided by the user.
    voltage = Math.max(11.5, 12.8 - (Math.max(0, 6000 - lux) / 12000));

    if (motion === 1) {
      // Full brightness: 1500-1700mA
      current = Math.floor(1500 + Math.random() * (1700 - 1500 + 1));
    } else {
      // Dim mode: 50-150mA
      current = Math.floor(50 + Math.random() * (150 - 50 + 1));
    }
  }

  const power = Math.round(voltage * (current / 1000) * 1000); // V * mA = mW

  return {
    voltage: parseFloat(voltage.toFixed(2)),
    current,
    power,
  };
}

// Fills (only) missing INA219 fields using the simulation.
// If a real field is already available (finite number), it is preserved.
export function applyStreetlight2Ina219Simulation({
  realVoltage,
  realCurrent,
  realPower,
  ldr,
  lux,
  motion,
}: {
  realVoltage: number;
  realCurrent: number;
  realPower: number;
  ldr: number;
  lux: number;
  motion: MotionFlag;
}): Streetlight2Ina219SimulationResult {
  const simulated = simulateStreetlight2Ina219({ ldr, lux, motion });

  const voltage = isFiniteNumber(realVoltage) ? realVoltage : simulated.voltage;
  const current = isFiniteNumber(realCurrent) ? realCurrent : simulated.current;
  const power = isFiniteNumber(realPower) ? realPower : Math.round(voltage * (current / 1000) * 1000);

  return {
    voltage: parseFloat(voltage.toFixed(2)),
    current: Math.round(current),
    power: Math.round(power),
  };
}

