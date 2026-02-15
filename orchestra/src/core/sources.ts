import fs from 'node:fs/promises';
import sharp from 'sharp';
import { ImageBuffer } from './image';
import { ColorInput, toRgba } from './color';
import { ImageSource, PixelLike, PixelFormat } from './types';

/**
 * Creates an ImageSource from a local file path.
 */
export function sourceFromPath(path: string): ImageSource {
  return { type: 'path', path };
}

/**
 * Creates an ImageSource from a remote URL.
 */
export function sourceFromUrl(url: string): ImageSource {
  return { type: 'url', url };
}

/**
 * Creates an ImageSource from a data URI.
 */
export function sourceFromDataUri(dataUri: string): ImageSource {
  return { type: 'datauri', dataUri };
}

/**
 * Creates an ImageSource from a raw image buffer.
 */
export function sourceFromBuffer(buffer: Buffer): ImageSource {
  return { type: 'buffer', buffer };
}

/**
 * Creates an empty ImageSource with optional fill color.
 */
export function sourceFromEmpty(
  width: number,
  height: number,
  format: PixelFormat = 'rgba8',
  fill?: PixelLike
): ImageSource {
  return { type: 'empty', width, height, format, fill };
}

/**
 * Loads an image source into an ImageBuffer.
 */
export async function loadImage(source: ImageSource): Promise<ImageBuffer> {
  if (source.type === 'empty') {
    return ImageBuffer.create(source.width, source.height, source.format ?? 'rgba8', source.fill);
  }

  const buffer = await resolveBuffer(source);
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelData = new Uint8Array(data);
  return new ImageBuffer(info.width, info.height, 'rgba8', pixelData);
}

/**
 * Output encoding options for image serialization.
 */
export type SaveImageOptions = {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
};

/**
 * Resize options for image buffers.
 */
export type ResizeOptions = {
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  withoutEnlargement?: boolean;
};

/**
 * Text font source configuration.
 */
export type TextFontSource = {
  filePath?: string;
  data?: Buffer;
  mime?: string;
};

/**
 * Text font configuration.
 */
export type TextFont = {
  family: string;
  source?: TextFontSource;
  weight?: number | string;
  style?: 'normal' | 'italic' | 'oblique';
};

/**
 * Text layout options.
 */
export type TextLayout = {
  x: number;
  y: number;
  maxWidth?: number;
  maxLines?: number;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
};

/**
 * Text style options.
 */
export type TextStyle = {
  fontSize?: number;
  color?: ColorInput;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  opacity?: number;
};

/**
 * Text rendering options.
 */
export type TextOptions = {
  text: string;
  font: TextFont;
  layout: TextLayout;
  style?: TextStyle;
};

/**
 * Serializes an ImageBuffer to an encoded image buffer.
 */
export async function imageToBuffer(
  image: ImageBuffer,
  options: SaveImageOptions = {}
): Promise<Buffer> {
  const rgba = image.format === 'rgba8' ? image : image.toFormat('rgba8');
  const buffer = Buffer.from(rgba.data as Uint8Array);
  let pipeline = sharp(buffer, { raw: { width: rgba.width, height: rgba.height, channels: 4 } });
  const format = options.format ?? 'png';
  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: options.quality ?? 90 });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: options.quality ?? 90 });
  } else {
    pipeline = pipeline.png();
  }
  return pipeline.toBuffer();
}

/**
 * Saves an ImageBuffer to a local file.
 */
export async function saveImage(
  image: ImageBuffer,
  outputPath: string,
  options: SaveImageOptions = {}
): Promise<void> {
  const buffer = await imageToBuffer(image, options);
  await fs.writeFile(outputPath, buffer);
}

/**
 * Resizes an ImageBuffer and returns a new buffer.
 */
export async function resizeImage(
  image: ImageBuffer,
  width: number,
  height: number,
  options: ResizeOptions = {}
): Promise<ImageBuffer> {
  const rgba = image.format === 'rgba8' ? image : image.toFormat('rgba8');
  const buffer = Buffer.from(rgba.data as Uint8Array);
  const { data, info } = await sharp(buffer, {
    raw: { width: rgba.width, height: rgba.height, channels: 4 },
  })
    .resize(width, height, {
      fit: options.fit ?? 'fill',
      withoutEnlargement: options.withoutEnlargement ?? false,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new ImageBuffer(info.width, info.height, 'rgba8', new Uint8Array(data));
}

/**
 * Renders text onto an ImageBuffer.
 */
export async function renderText(image: ImageBuffer, options: TextOptions): Promise<ImageBuffer> {
  const base = await imageToBuffer(image, { format: 'png' });
  const svg = await buildTextSvg(image.width, image.height, options);
  const { data, info } = await sharp(base)
    .composite([{ input: Buffer.from(svg) }])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = new ImageBuffer(info.width, info.height, 'rgba8', new Uint8Array(data));
  return image.format === 'rgba8' ? output : output.toFormat(image.format);
}

async function resolveBuffer(source: ImageSource): Promise<Buffer> {
  if (source.type === 'buffer') {
    return source.buffer;
  }
  if (source.type === 'path') {
    return fs.readFile(source.path);
  }
  if (source.type === 'url') {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (source.type === 'datauri') {
    return decodeDataUri(source.dataUri);
  }
  throw new Error('Unsupported image source');
}

function decodeDataUri(dataUri: string): Buffer {
  const [meta, data] = dataUri.split(',');
  if (!data) {
    throw new Error('Invalid data URI');
  }
  const isBase64 = /;base64/i.test(meta);
  if (isBase64) {
    return Buffer.from(data, 'base64');
  }
  return Buffer.from(decodeURIComponent(data));
}

async function buildTextSvg(width: number, height: number, options: TextOptions): Promise<string> {
  const layout = options.layout;
  const style = options.style ?? {};
  const fontSize = style.fontSize ?? 48;
  const fontWeight = style.bold ? 700 : (options.font.weight ?? 400);
  const fontStyle = style.italic ? 'italic' : (options.font.style ?? 'normal');
  const opacity = style.opacity ?? 1;
  const lineHeight = layout.lineHeight ?? Math.round(fontSize * 1.25);
  const align = layout.align ?? 'left';
  const letterSpacing = layout.letterSpacing ?? 0;
  const color = style.color ?? '#ffffff';
  const rgba = normalizeColor(color, opacity);
  const textAnchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const lines = wrapText(options.text, layout.maxWidth, fontSize, layout.maxLines);
  const x =
    align === 'left'
      ? layout.x
      : align === 'center'
        ? layout.x + (layout.maxWidth ?? 0) / 2
        : layout.x + (layout.maxWidth ?? 0);
  const y = layout.y + fontSize;
  const textDecoration = [
    style.underline ? 'underline' : null,
    style.strikethrough ? 'line-through' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const fontFace = await buildFontFace(options.font);
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <style>
    ${fontFace}
  </style>
  <text x="${x}" y="${y}" text-anchor="${textAnchor}" font-family="${escapeXml(options.font.family)}"
    font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}"
    fill="${rgba}" fill-opacity="${opacity}" letter-spacing="${letterSpacing}" text-decoration="${textDecoration}">
    ${tspans}
  </text>
</svg>`;
}

async function buildFontFace(font: TextFont): Promise<string> {
  if (!font.source?.filePath && !font.source?.data) {
    return '';
  }
  const data = font.source.data ?? (await fs.readFile(font.source.filePath as string));
  const mime = font.source.mime ?? guessFontMime(font.source.filePath);
  const encoded = data.toString('base64');
  return `@font-face {
      font-family: '${escapeXml(font.family)}';
      src: url("data:${mime};base64,${encoded}");
    }`;
}

function guessFontMime(filePath?: string): string {
  if (!filePath) return 'font/ttf';
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'otf') return 'font/otf';
  if (ext === 'woff') return 'font/woff';
  if (ext === 'woff2') return 'font/woff2';
  return 'font/ttf';
}

function wrapText(
  text: string,
  maxWidth: number | undefined,
  fontSize: number,
  maxLines?: number
): string[] {
  if (!maxWidth) {
    return text.split('\n');
  }
  const words = text.split(/\s+/).filter(Boolean);
  const approxCharWidth = fontSize * 0.6;
  const maxChars = Math.max(1, Math.floor(maxWidth / approxCharWidth));
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (maxLines && lines.length >= maxLines) break;
  }
  if (current && (!maxLines || lines.length < maxLines)) {
    lines.push(current);
  }
  if (maxLines && lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }
  return lines.length === 0 ? [''] : lines;
}

function normalizeColor(color: ColorInput, opacity: number): string {
  const rgba = toRgba(color);
  const alpha = Math.max(0, Math.min(1, (rgba.a / 255) * opacity));
  return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${alpha})`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
