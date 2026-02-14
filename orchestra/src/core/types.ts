/**
 * Pixel storage format for an ImageBuffer.
 * - rgba8/rgb8/gray8 use 0-255 integer channels.
 * - rgba32f uses 0-1 floating point channels.
 */
export type PixelFormat = 'rgba8' | 'rgb8' | 'gray8' | 'rgba32f';

/**
 * Fully expanded pixel with RGBA channels in 0-255 space.
 */
export type Pixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * Pixel-like input that can omit alpha (defaults to 255).
 */
export type PixelLike = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

/**
 * Supported image inputs for pipelines.
 */
export type ImageSource =
  | { type: 'path'; path: string }
  | { type: 'url'; url: string }
  | { type: 'datauri'; dataUri: string }
  | { type: 'buffer'; buffer: Buffer }
  | {
      type: 'empty';
      width: number;
      height: number;
      format?: PixelFormat;
      fill?: PixelLike;
    };
