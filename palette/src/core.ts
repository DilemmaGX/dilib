import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  Hct,
  QuantizerCelebi,
  Score,
  TonalPalette,
  argbFromRgb,
  hexFromArgb,
} from '@material/material-color-utilities';

/**
 * Supported input types for palette generation.
 */
export type InputType = 'hex' | 'datauri' | 'url' | 'path';

/**
 * Built-in palette algorithms.
 */
export type BuiltInPaletteAlgorithm =
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'tetradic'
  | 'split-complementary'
  | 'monochrome'
  | 'monet';

/**
 * Palette algorithm name, including custom algorithms.
 */
export type PaletteAlgorithm = BuiltInPaletteAlgorithm | (string & { __paletteAlgorithm?: never });

/**
 * Input for palette generators.
 */
export interface PaletteGeneratorInput {
  inputType: InputType;
  baseColor: string;
  baseRgb: RgbColor;
  baseHsl: HslColor;
  count?: number;
  buffer?: Buffer;
}

/**
 * Palette generator contract.
 */
export type PaletteGenerator = (
  input: PaletteGeneratorInput
) => Promise<string[]> | string[];

/**
 * Options used when generating palettes.
 */
export interface PaletteOptions {
  /**
   * Palette algorithm to apply.
   */
  algorithm?: PaletteAlgorithm;
  /**
   * Palette size hint.
   */
  count?: number;
}

/**
 * Palette generation result.
 */
export interface PaletteResult {
  /**
   * Detected input type.
   */
  inputType: InputType;
  /**
   * Algorithm used for palette generation.
   */
  algorithm: PaletteAlgorithm;
  /**
   * Base color extracted from input.
   */
  baseColor: string;
  /**
   * Generated palette colors in HEX.
   */
  colors: string[];
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

const DEFAULT_ALGORITHM: BuiltInPaletteAlgorithm = 'analogous';

const algorithmRegistry = new Map<string, PaletteGenerator>();
let builtInsRegistered = false;

/**
 * Registers a custom palette algorithm.
 */
export function registerAlgorithm(name: string, generator: PaletteGenerator): void {
  if (!name.trim()) {
    throw new Error('Algorithm name is required');
  }
  algorithmRegistry.set(name, generator);
}

/**
 * Unregisters a palette algorithm.
 */
export function unregisterAlgorithm(name: string): boolean {
  return algorithmRegistry.delete(name);
}

/**
 * Returns a registered algorithm by name.
 */
export function getAlgorithm(name: string): PaletteGenerator | undefined {
  return algorithmRegistry.get(name);
}

/**
 * Returns the list of supported palette algorithms.
 */
export function listAlgorithms(): PaletteAlgorithm[] {
  return Array.from(algorithmRegistry.keys()).sort();
}

/**
 * Detects the input type from the raw string.
 * @param input The raw input string.
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  if (isHex(trimmed)) return 'hex';
  if (isDataUri(trimmed)) return 'datauri';
  if (isUrl(trimmed)) return 'url';
  return 'path';
}

/**
 * Generates a palette by automatically detecting the input type.
 * @param input The input string.
 * @param options Optional palette options.
 */
export async function generatePalette(
  input: string,
  options: PaletteOptions = {}
): Promise<PaletteResult> {
  const type = detectInputType(input);
  if (type === 'hex') return generatePaletteFromHex(input, options);
  if (type === 'datauri') return generatePaletteFromDataUri(input, options);
  if (type === 'url') return generatePaletteFromUrl(input, options);
  return generatePaletteFromPath(input, options);
}

/**
 * Generates a palette from a HEX color string.
 * @param hex The HEX string, with or without leading #.
 * @param options Optional palette options.
 */
export async function generatePaletteFromHex(
  hex: string,
  options: PaletteOptions = {}
): Promise<PaletteResult> {
  const normalizedHex = normalizeHex(hex);
  const baseRgb = hexToRgb(normalizedHex);
  return buildPaletteResultFromBase(baseRgb, 'hex', options.algorithm, options.count);
}

/**
 * Generates a palette from an image data URI.
 * @param dataUri The image data URI.
 * @param options Optional palette options.
 */
export async function generatePaletteFromDataUri(
  dataUri: string,
  options: PaletteOptions = {}
): Promise<PaletteResult> {
  const buffer = decodeDataUri(dataUri);
  return buildPaletteResultFromBuffer(buffer, 'datauri', options.algorithm, options.count);
}

/**
 * Generates a palette from an image URL.
 * @param url The image URL.
 * @param options Optional palette options.
 */
export async function generatePaletteFromUrl(
  url: string,
  options: PaletteOptions = {}
): Promise<PaletteResult> {
  const buffer = await fetchBuffer(url);
  return buildPaletteResultFromBuffer(buffer, 'url', options.algorithm, options.count);
}

/**
 * Generates a palette from an image file path.
 * @param filePath The file path to the image.
 * @param options Optional palette options.
 */
export async function generatePaletteFromPath(
  filePath: string,
  options: PaletteOptions = {}
): Promise<PaletteResult> {
  const resolved = path.resolve(filePath);
  const buffer = await fs.readFile(resolved);
  return buildPaletteResultFromBuffer(buffer, 'path', options.algorithm, options.count);
}

/**
 * Builds a palette result from an image buffer.
 * @param buffer The image buffer.
 * @param inputType The detected input type.
 * @param algorithm Optional algorithm override.
 * @param count Optional palette size.
 */
async function buildPaletteResultFromBuffer(
  buffer: Buffer,
  inputType: InputType,
  algorithm?: PaletteAlgorithm,
  count?: number
): Promise<PaletteResult> {
  const resolvedAlgorithm = resolveAlgorithm(algorithm);
  const baseRgb = await getAverageColor(buffer);
  const baseHex = rgbToHex(baseRgb);
  return buildPaletteResult(
    {
      inputType,
      baseColor: baseHex,
      baseRgb,
      baseHsl: rgbToHsl(baseRgb),
      count,
      buffer,
    },
    resolvedAlgorithm
  );
}

/**
 * Builds a palette result from a base color.
 * @param baseRgb The base RGB color.
 * @param inputType The detected input type.
 * @param algorithm Optional algorithm override.
 * @param count Optional palette size.
 */
async function buildPaletteResultFromBase(
  baseRgb: RgbColor,
  inputType: InputType,
  algorithm?: PaletteAlgorithm,
  count?: number
): Promise<PaletteResult> {
  const resolvedAlgorithm = resolveAlgorithm(algorithm);
  const baseHex = rgbToHex(baseRgb);
  return buildPaletteResult(
    {
      inputType,
      baseColor: baseHex,
      baseRgb,
      baseHsl: rgbToHsl(baseRgb),
      count,
    },
    resolvedAlgorithm
  );
}

/**
 * Resolves an algorithm, applying defaults and validation.
 * @param algorithm Optional algorithm override.
 */
function resolveAlgorithm(algorithm: PaletteAlgorithm | undefined): PaletteAlgorithm {
  const resolved = algorithm ?? DEFAULT_ALGORITHM;
  if (!algorithmRegistry.has(resolved)) {
    throw new Error(`Unknown algorithm: ${resolved}`);
  }
  return resolved;
}

/**
 * Builds a palette in HSL space.
 * @param base The base HSL color.
 * @param algorithm The algorithm to apply.
 * @param count Optional palette size.
 */
function buildPaletteHsl(base: HslColor, algorithm: PaletteAlgorithm, count?: number): HslColor[] {
  const hue = normalizeHue(base.h);
  const sat = clamp(base.s, 20, 90);
  const light = clamp(base.l, 20, 80);

  if (algorithm === 'analogous') {
    return buildByOffsets(hue, sat, light, resolveCount(count, 5), 40);
  }

  if (algorithm === 'complementary') {
    return buildByCycle(hue, sat, light, resolveCount(count, 3), [0, 180], 14);
  }

  if (algorithm === 'triadic') {
    return buildByCycle(hue, sat, light, resolveCount(count, 3), [0, 120, 240], 10);
  }

  if (algorithm === 'tetradic') {
    return buildByCycle(hue, sat, light, resolveCount(count, 4), [0, 90, 180, 270], 8);
  }

  if (algorithm === 'split-complementary') {
    return buildByCycle(hue, sat, light, resolveCount(count, 3), [0, 150, 210], 10);
  }

  if (algorithm === 'monochrome') {
    return buildMonochrome(hue, sat, light, resolveCount(count, 4));
  }

  return buildMonochrome(hue, sat, light, resolveCount(count, 6));
}

function buildHslPaletteColors(
  input: PaletteGeneratorInput,
  algorithm: BuiltInPaletteAlgorithm
): string[] {
  const paletteHsl = buildPaletteHsl(input.baseHsl, algorithm, input.count);
  return paletteHsl.map((color) => rgbToHex(hslToRgb(color)));
}

function registerBuiltInAlgorithms(): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  registerAlgorithm('analogous', (input) => buildHslPaletteColors(input, 'analogous'));
  registerAlgorithm('complementary', (input) => buildHslPaletteColors(input, 'complementary'));
  registerAlgorithm('triadic', (input) => buildHslPaletteColors(input, 'triadic'));
  registerAlgorithm('tetradic', (input) => buildHslPaletteColors(input, 'tetradic'));
  registerAlgorithm('split-complementary', (input) =>
    buildHslPaletteColors(input, 'split-complementary')
  );
  registerAlgorithm('monochrome', (input) => buildHslPaletteColors(input, 'monochrome'));
  registerAlgorithm('monet', async (input) => {
    if (input.buffer) {
      const colors = await extractMonetPalette(input.buffer, resolveMonetCount(input.count, 6));
      if (colors.length > 0) {
        return colors;
      }
    }
    const sourceArgb = argbFromHex(input.baseColor);
    return buildMonetPaletteFromSourceArgb(sourceArgb, resolveMonetCount(input.count, 6));
  });
}

registerBuiltInAlgorithms();

async function buildPaletteResult(
  input: PaletteGeneratorInput,
  algorithm: PaletteAlgorithm
): Promise<PaletteResult> {
  const generator = getAlgorithm(algorithm);
  if (!generator) {
    throw new Error(`Unknown algorithm: ${algorithm}`);
  }
  const colors = await generator(input);
  return {
    inputType: input.inputType,
    algorithm,
    baseColor: input.baseColor,
    colors,
  };
}

/**
 * Checks whether a string is a valid HEX color.
 * @param value The string to validate.
 */
function isHex(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * Checks whether a string is an image data URI.
 * @param value The string to validate.
 */
function isDataUri(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

/**
 * Checks whether a string is an HTTP(S) URL.
 * @param value The string to validate.
 */
function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Normalizes HEX input to #RRGGBB format.
 * @param value The HEX string.
 */
function normalizeHex(value: string): string {
  const raw = value.trim();
  if (!isHex(raw)) throw new Error(`Invalid HEX color: ${value}`);
  const cleaned = raw.startsWith('#') ? raw.slice(1) : raw;
  if (cleaned.length === 3) {
    const expanded = cleaned
      .split('')
      .map((char) => char + char)
      .join('');
    return `#${expanded.toUpperCase()}`;
  }
  return `#${cleaned.toUpperCase()}`;
}

function argbFromHex(hex: string): number {
  const clean = normalizeHex(hex).slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return argbFromRgb(r, g, b);
}

/**
 * Converts HEX to RGB.
 * @param hex The HEX color string.
 */
function hexToRgb(hex: string): RgbColor {
  const clean = normalizeHex(hex).slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Converts RGB to HEX.
 * @param color The RGB color.
 */
function rgbToHex(color: RgbColor): string {
  const toHex = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

/**
 * Converts RGB to HSL.
 * @param color The RGB color.
 */
function rgbToHsl(color: RgbColor): HslColor {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

/**
 * Converts HSL to RGB.
 * @param color The HSL color.
 */
function hslToRgb(color: HslColor): RgbColor {
  const h = normalizeHue(color.h);
  const s = clamp(color.s, 0, 100) / 100;
  const l = clamp(color.l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h >= 0 && h < 60) {
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
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

/**
 * Computes the average color of an image buffer.
 * @param buffer The image buffer.
 */
async function getAverageColor(buffer: Buffer): Promise<RgbColor> {
  const stats = await sharp(buffer).stats();
  const channels = stats.channels;
  return {
    r: channels[0]?.mean ?? 0,
    g: channels[1]?.mean ?? 0,
    b: channels[2]?.mean ?? 0,
  };
}

/**
 * Extracts a Monet-style palette from an image buffer.
 * @param buffer The image buffer.
 * @param count The number of colors to return.
 */
async function extractMonetPalette(buffer: Buffer, count: number): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize({ width: 48, height: 48, fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels: number[] = [];
  const step = info.channels;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    pixels.push(argbFromRgb(r, g, b));
  }
  if (pixels.length === 0) return [];
  const sampled = downsamplePixels(pixels, 1200);
  const quantized = QuantizerCelebi.quantize(sampled, 128);
  const ranked = Score.score(quantized);
  const sourceArgb = ranked[0] ?? sampled[0];
  return buildMonetPaletteFromSourceArgb(sourceArgb, count);
}

/**
 * Resolves the palette size with bounds.
 * @param count Optional requested count.
 * @param fallback Default count.
 */
function resolveCount(count: number | undefined, fallback: number): number {
  if (!count) return fallback;
  return Math.max(2, Math.min(12, Math.floor(count)));
}

function resolveMonetCount(count: number | undefined, fallback: number): number {
  if (!count) return fallback;
  return Math.max(1, Math.floor(count));
}

/**
 * Builds hue offsets distributed across a range.
 * @param count Number of offsets.
 * @param maxOffset Maximum absolute offset.
 */
function buildOffsets(count: number, maxOffset: number): number[] {
  if (count <= 1) return [0];
  const step = (maxOffset * 2) / (count - 1);
  const offsets: number[] = [];
  for (let i = 0; i < count; i += 1) {
    offsets.push(-maxOffset + i * step);
  }
  return offsets;
}

/**
 * Builds lightness offsets distributed across a range.
 * @param count Number of offsets.
 * @param maxOffset Maximum absolute offset.
 */
function buildLightOffsets(count: number, maxOffset: number): number[] {
  if (count <= 1) return [0];
  const step = (maxOffset * 2) / (count - 1);
  const offsets: number[] = [];
  for (let i = 0; i < count; i += 1) {
    offsets.push(-maxOffset + i * step);
  }
  return offsets;
}

/**
 * Builds HSL colors by evenly spaced hue offsets.
 * @param hue Base hue.
 * @param sat Base saturation.
 * @param light Base lightness.
 * @param count Number of colors.
 * @param maxOffset Maximum hue offset.
 */
function buildByOffsets(
  hue: number,
  sat: number,
  light: number,
  count: number,
  maxOffset: number
): HslColor[] {
  const offsets = buildOffsets(count, maxOffset);
  return offsets.map((offset) => ({
    h: normalizeHue(hue + offset),
    s: clamp(sat, 0, 100),
    l: clamp(light, 0, 100),
  }));
}

/**
 * Builds HSL colors by cycling hue offsets with lightness variation.
 * @param hue Base hue.
 * @param sat Base saturation.
 * @param light Base lightness.
 * @param count Number of colors.
 * @param offsets Hue offsets to cycle.
 * @param lightStep Lightness step per cycle layer.
 */
function buildByCycle(
  hue: number,
  sat: number,
  light: number,
  count: number,
  offsets: number[],
  lightStep: number
): HslColor[] {
  const result: HslColor[] = [];
  for (let i = 0; i < count; i += 1) {
    const offset = offsets[i % offsets.length] ?? 0;
    const layer = Math.floor(i / offsets.length);
    const delta = (layer % 2 === 0 ? 1 : -1) * lightStep * (layer + 1) * 0.5;
    result.push({
      h: normalizeHue(hue + offset),
      s: clamp(sat, 0, 100),
      l: clamp(light + delta, 0, 100),
    });
  }
  return result;
}

/**
 * Builds a monochrome palette by lightness offsets.
 * @param hue Base hue.
 * @param sat Base saturation.
 * @param light Base lightness.
 * @param count Number of colors.
 */
function buildMonochrome(hue: number, sat: number, light: number, count: number): HslColor[] {
  const offsets = buildLightOffsets(count, 20);
  return offsets.map((offset) => ({
    h: normalizeHue(hue),
    s: clamp(sat, 0, 100),
    l: clamp(light + offset, 0, 100),
  }));
}

/**
 * Downsamples pixels to a maximum size.
 * @param pixels The pixel list.
 * @param max Maximum number of pixels.
 */
function downsamplePixels(pixels: number[], max: number): number[] {
  if (pixels.length <= max) return pixels;
  const stride = Math.ceil(pixels.length / max);
  const result: number[] = [];
  for (let i = 0; i < pixels.length; i += stride) {
    result.push(pixels[i]);
  }
  return result;
}
function buildMonetPaletteFromSourceArgb(sourceArgb: number, count: number): string[] {
  const hct = Hct.fromInt(sourceArgb);
  const palette = TonalPalette.fromHct(hct);
  const tones = buildToneSteps(count);
  return tones.map((tone) => hexFromArgb(palette.tone(tone)));
}

function buildToneSteps(count: number): number[] {
  const base = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 98, 100];
  if (count <= base.length) {
    return base.slice(0, count);
  }
  const tones: number[] = [];
  for (let i = 0; i < count; i += 1) {
    tones.push(Math.round((100 * i) / (count - 1)));
  }
  return tones;
}

/**
 * Decodes a data URI into a buffer.
 * @param value The data URI string.
 */
function decodeDataUri(value: string): Buffer {
  if (!isDataUri(value)) {
    throw new Error('Invalid data URI');
  }
  const base64 = value.split(',')[1] ?? '';
  return Buffer.from(base64, 'base64');
}

/**
 * Fetches a URL and returns the response as a buffer.
 * @param url The resource URL.
 */
async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Clamps a number between min and max.
 * @param value The input value.
 * @param min Minimum value.
 * @param max Maximum value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalizes hue to the [0, 360) range.
 * @param hue The input hue.
 */
function normalizeHue(hue: number): number {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
