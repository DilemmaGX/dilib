/**
 * Deterministic RNG powered by a 32-bit seed.
 */
export class SeededRandom {
  private state: number;

  /**
   * Creates a new RNG with a specific seed.
   */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a float in the range [0, 1).
   */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return result;
  }

  /**
   * Alias of next() for semantic clarity.
   */
  nextFloat(): number {
    return this.next();
  }

  /**
   * Returns an integer in the inclusive range [min, max].
   */
  nextInt(min: number, max: number): number {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(this.next() * (high - low + 1)) + low;
  }

  /**
   * Returns a float in the range [min, max).
   */
  nextRange(min: number, max: number): number {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return this.next() * (high - low) + low;
  }

  /**
   * Returns a normally distributed random number.
   */
  nextGaussian(mean = 0, stdDev = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    const z0 = mag * Math.cos(2.0 * Math.PI * v);
    return z0 * stdDev + mean;
  }
}

/**
 * Creates a seeded RNG from a number or string seed.
 * When omitted, the seed is derived from current time.
 */
export function createRandom(seed?: number | string): SeededRandom {
  if (seed === undefined || seed === null) {
    return new SeededRandom(hashSeed(Date.now()));
  }
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return new SeededRandom(hashSeed(seed));
  }
  return new SeededRandom(hashSeed(String(seed)));
}

function hashSeed(seed: number | string): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
