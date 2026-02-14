import fs from 'node:fs/promises';
import sharp from 'sharp';
import { ImageBuffer } from './image';
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
