import { ColorInput, toRgba } from './color';
import { Pixel, PixelFormat, PixelLike } from './types';

const FORMAT_CHANNELS: Record<PixelFormat, number> = {
  rgba8: 4,
  rgb8: 3,
  gray8: 1,
  rgba32f: 4,
};

/**
 * In-memory pixel buffer with utility helpers for per-pixel manipulation.
 */
export class ImageBuffer {
  readonly width: number;
  readonly height: number;
  readonly format: PixelFormat;
  readonly data: Uint8Array | Float32Array;

  /**
   * Creates an ImageBuffer with given size and format.
   * If data is provided, it must match width * height * channels.
   */
  constructor(
    width: number,
    height: number,
    format: PixelFormat,
    data?: Uint8Array | Float32Array
  ) {
    this.width = width;
    this.height = height;
    this.format = format;
    const length = width * height * FORMAT_CHANNELS[format];
    if (data) {
      if (data.length !== length) {
        throw new Error('ImageBuffer data length mismatch');
      }
      this.data = data;
    } else {
      this.data = format === 'rgba32f' ? new Float32Array(length) : new Uint8Array(length);
    }
  }

  /**
   * Creates a new ImageBuffer and optionally fills it with a color.
   */
  static create(width: number, height: number, format: PixelFormat, fill?: PixelLike): ImageBuffer {
    const image = new ImageBuffer(width, height, format);
    if (fill) {
      image.fill(fill);
    }
    return image;
  }

  /**
   * Clones the buffer and its pixel data.
   */
  clone(): ImageBuffer {
    const copy =
      this.format === 'rgba32f'
        ? new Float32Array(this.data as Float32Array)
        : new Uint8Array(this.data as Uint8Array);
    return new ImageBuffer(this.width, this.height, this.format, copy);
  }

  /**
   * Reads a pixel at the given coordinates.
   * Returned values are always in 0-255 RGBA space.
   */
  getPixel(x: number, y: number): Pixel {
    this.assertInside(x, y);
    const index = (y * this.width + x) * FORMAT_CHANNELS[this.format];
    if (this.format === 'gray8') {
      const gray = (this.data as Uint8Array)[index];
      return { r: gray, g: gray, b: gray, a: 255 };
    }
    if (this.format === 'rgb8') {
      const data = this.data as Uint8Array;
      return { r: data[index], g: data[index + 1], b: data[index + 2], a: 255 };
    }
    if (this.format === 'rgba32f') {
      const data = this.data as Float32Array;
      return {
        r: toByte(data[index]),
        g: toByte(data[index + 1]),
        b: toByte(data[index + 2]),
        a: toByte(data[index + 3]),
      };
    }
    const data = this.data as Uint8Array;
    return { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] };
  }

  /**
   * Writes a pixel at the given coordinates.
   * Accepts either 0-255 or 0-1 values depending on source usage.
   */
  setPixel(x: number, y: number, pixel: PixelLike): void {
    this.assertInside(x, y);
    const index = (y * this.width + x) * FORMAT_CHANNELS[this.format];
    const a = pixel.a ?? 255;
    if (this.format === 'gray8') {
      const value = toByte((pixel.r + pixel.g + pixel.b) / 3);
      (this.data as Uint8Array)[index] = value;
      return;
    }
    if (this.format === 'rgb8') {
      const data = this.data as Uint8Array;
      data[index] = toByte(pixel.r);
      data[index + 1] = toByte(pixel.g);
      data[index + 2] = toByte(pixel.b);
      return;
    }
    if (this.format === 'rgba32f') {
      const data = this.data as Float32Array;
      data[index] = toFloat(pixel.r);
      data[index + 1] = toFloat(pixel.g);
      data[index + 2] = toFloat(pixel.b);
      data[index + 3] = toFloat(a);
      return;
    }
    const data = this.data as Uint8Array;
    data[index] = toByte(pixel.r);
    data[index + 1] = toByte(pixel.g);
    data[index + 2] = toByte(pixel.b);
    data[index + 3] = toByte(a);
  }

  /**
   * Writes a pixel using any supported color input.
   */
  setPixelColor(x: number, y: number, color: ColorInput): void {
    const rgba = toRgba(color);
    this.setPixel(x, y, rgba);
  }

  /**
   * Fills the entire image with a single color.
   */
  fill(pixel: PixelLike): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.setPixel(x, y, pixel);
      }
    }
  }

  /**
   * Fills the image using any supported color input.
   */
  fillColor(color: ColorInput): void {
    const rgba = toRgba(color);
    this.fill(rgba);
  }

  /**
   * Returns a 2D matrix of pixels for easy CPU-side processing.
   */
  toMatrix(): Pixel[][] {
    const rows: Pixel[][] = [];
    for (let y = 0; y < this.height; y += 1) {
      const row: Pixel[] = [];
      for (let x = 0; x < this.width; x += 1) {
        row.push(this.getPixel(x, y));
      }
      rows.push(row);
    }
    return rows;
  }

  /**
   * Maps every pixel through a callback and returns a new buffer.
   */
  mapPixels(mapper: (pixel: Pixel, x: number, y: number) => PixelLike): ImageBuffer {
    const output = new ImageBuffer(this.width, this.height, this.format);
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const current = this.getPixel(x, y);
        output.setPixel(x, y, mapper(current, x, y));
      }
    }
    return output;
  }

  /**
   * Converts the buffer into another format.
   */
  toFormat(format: PixelFormat): ImageBuffer {
    if (format === this.format) {
      return this.clone();
    }
    const output = new ImageBuffer(this.width, this.height, format);
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        output.setPixel(x, y, this.getPixel(x, y));
      }
    }
    return output;
  }

  private assertInside(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      throw new Error('Pixel coordinate out of bounds');
    }
  }
}

function toByte(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  const scaled = value <= 1 ? value * 255 : value;
  return Math.max(0, Math.min(255, Math.round(scaled)));
}

function toFloat(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value > 1) {
    return Math.max(0, Math.min(1, value / 255));
  }
  return Math.max(0, Math.min(1, value));
}
