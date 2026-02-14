/**
 * RGB color in 0-255 space.
 */
export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

/**
 * RGBA color in 0-255 space.
 */
export type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * HSL color, h in degrees, s/l in 0-100.
 */
export type HslColor = {
  h: number;
  s: number;
  l: number;
};

/**
 * HSLA color, h in degrees, s/l in 0-100, a in 0-1 or 0-255.
 */
export type HslaColor = {
  h: number;
  s: number;
  l: number;
  a: number;
};

/**
 * HSV color, h in degrees, s/v in 0-100.
 */
export type HsvColor = {
  h: number;
  s: number;
  v: number;
};

/**
 * HSVA color, h in degrees, s/v in 0-100, a in 0-1 or 0-255.
 */
export type HsvaColor = {
  h: number;
  s: number;
  v: number;
  a: number;
};

/**
 * Supported color inputs for nodes and utilities.
 */
export type ColorInput =
  | RgbaColor
  | RgbColor
  | HslColor
  | HslaColor
  | HsvColor
  | HsvaColor
  | string;

/**
 * Converts a color input into RGBA in 0-255 space.
 */
export function toRgba(input: ColorInput): RgbaColor {
  if (typeof input === 'string') {
    return hexToRgba(input);
  }
  if ('v' in input) {
    return hsvaToRgba({
      h: input.h,
      s: input.s,
      v: input.v,
      a: 'a' in input ? input.a : 1,
    });
  }
  if ('l' in input) {
    return hslaToRgba({
      h: input.h,
      s: input.s,
      l: input.l,
      a: 'a' in input ? input.a : 1,
    });
  }
  const alpha = 'a' in input ? input.a : 255;
  return {
    r: clampByte(input.r),
    g: clampByte(input.g),
    b: clampByte(input.b),
    a: normalizeAlpha(alpha),
  };
}

/**
 * Converts RGBA to hex string.
 */
export function rgbaToHex(rgba: RgbaColor): string {
  const r = clampByte(rgba.r).toString(16).padStart(2, '0');
  const g = clampByte(rgba.g).toString(16).padStart(2, '0');
  const b = clampByte(rgba.b).toString(16).padStart(2, '0');
  const a = clampByte(rgba.a).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
}

/**
 * Converts hex string (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) into RGBA.
 */
export function hexToRgba(hex: string): RgbaColor {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length === 3 || normalized.length === 4) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    const a = normalized.length === 4 ? parseInt(normalized[3] + normalized[3], 16) : 255;
    return { r, g, b, a };
  }
  if (normalized.length === 6 || normalized.length === 8) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const a = normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) : 255;
    return { r, g, b, a };
  }
  throw new Error('Invalid hex color');
}

/**
 * Converts RGBA into HSVA.
 */
export function rgbaToHsva(rgba: RgbaColor): HsvaColor {
  const r = clamp(rgba.r, 0, 255) / 255;
  const g = clamp(rgba.g, 0, 255) / 255;
  const b = clamp(rgba.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  const hue = normalizeHue(h * 60);
  const sat = max === 0 ? 0 : delta / max;
  return {
    h: hue,
    s: Math.round(sat * 100),
    v: Math.round(max * 100),
    a: normalizeAlpha(rgba.a),
  };
}

/**
 * Converts HSVA into RGBA.
 */
export function hsvaToRgba(hsva: HsvaColor): RgbaColor {
  const h = normalizeHue(hsva.h);
  const s = clamp(hsva.s, 0, 100) / 100;
  const v = clamp(hsva.v, 0, 100) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
    a: normalizeAlpha(hsva.a),
  };
}

/**
 * Converts RGBA into HSLA.
 */
export function rgbaToHsla(rgba: RgbaColor): HslaColor {
  const r = clamp(rgba.r, 0, 255) / 255;
  const g = clamp(rgba.g, 0, 255) / 255;
  const b = clamp(rgba.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return {
    h: normalizeHue(h * 60),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: normalizeAlpha(rgba.a),
  };
}

/**
 * Converts HSLA into RGBA.
 */
export function hslaToRgba(hsla: HslaColor): RgbaColor {
  const h = normalizeHue(hsla.h);
  const s = clamp(hsla.s, 0, 100) / 100;
  const l = clamp(hsla.l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
    a: normalizeAlpha(hsla.a),
  };
}

/**
 * Computes squared RGB distance between two colors.
 */
export function colorDistance(a: RgbaColor, b: RgbaColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHue(hue: number): number {
  const mod = hue % 360;
  return mod < 0 ? mod + 360 : mod;
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function normalizeAlpha(alpha: number): number {
  if (alpha <= 1) {
    return clampByte(alpha * 255);
  }
  return clampByte(alpha);
}
