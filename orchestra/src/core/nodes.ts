import { ImageBuffer } from './image';
import { ColorInput, colorDistance, toRgba } from './color';
import { ImageSource, Pixel, PixelLike } from './types';
import { SeededRandom } from './random';
import { loadImage, ResizeOptions, resizeImage } from './sources';

/**
 * Runtime context shared across nodes in a pipeline run.
 */
export type NodeContext = {
  random: SeededRandom;
};

/**
 * Pipeline node definition.
 */
export type ImageNode = {
  name: string;
  params?: unknown;
  run: (context: NodeContext, image: ImageBuffer) => Promise<ImageBuffer> | ImageBuffer;
};

/**
 * Selector used to choose pixels for masked execution.
 */
export type PixelSelector = (pixel: Pixel, x: number, y: number, context: NodeContext) => boolean;

/**
 * Masking options for nodes.
 */
export type SelectionOptions = {
  /**
   * preserve: keep non-selected pixels from the original image.
   * clip: replace non-selected pixels with outsideColor.
   */
  mode?: SelectionMode;
  /**
   * Color used for clip mode. Defaults to transparent black.
   */
  outsideColor?: ColorInput;
};

/**
 * Masking mode for selection.
 */
export type SelectionMode = 'preserve' | 'clip';

/**
 * Mask source for color mapping.
 */
export type MaskMapSource = ImageSource | ImageBuffer | ImageNode;

/**
 * Color-to-source mapping entry.
 */
export type MaskMapEntry = {
  color: ColorInput;
  tolerance?: number;
  source?: MaskMapSource;
};

/**
 * Options for mask mapping nodes.
 */
export type MaskMapOptions = {
  defaultColor?: ColorInput;
  resize?: ResizeOptions;
};

/**
 * Rectangle selector options.
 */
export type RectSelectorOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Circle selector options.
 */
export type CircleSelectorOptions = {
  cx: number;
  cy: number;
  radius: number;
};

/**
 * Creates a rectangle selector.
 */
export function createRectSelector(options: RectSelectorOptions): PixelSelector {
  const left = options.x;
  const top = options.y;
  const right = options.x + options.width;
  const bottom = options.y + options.height;
  return (_pixel, x, y) => x >= left && x < right && y >= top && y < bottom;
}

/**
 * Creates a circle selector.
 */
export function createCircleSelector(options: CircleSelectorOptions): PixelSelector {
  const radius = Math.max(0, options.radius);
  const r2 = radius * radius;
  return (_pixel, x, y) => {
    const dx = x - options.cx;
    const dy = y - options.cy;
    return dx * dx + dy * dy <= r2;
  };
}

/**
 * Creates a luminance-based selector.
 */
export function createLumaSelector(threshold: number): PixelSelector {
  const value = clampByte(threshold);
  return (pixel) => {
    const luma = Math.round((pixel.r + pixel.g + pixel.b) / 3);
    return luma >= value;
  };
}

/**
 * Creates an alpha-based selector.
 */
export function createAlphaSelector(threshold: number): PixelSelector {
  const value = clampByte(threshold);
  return (pixel) => pixel.a >= value;
}

/**
 * Image node with typed parameters metadata.
 */
export type ParametricNode<TParams> = ImageNode & { params: TParams };

/**
 * Creates a node with typed parameters stored in the node metadata.
 */
export function createParamNode<TParams>(
  name: string,
  params: TParams,
  run: (context: NodeContext, image: ImageBuffer, params: TParams) => ImageBuffer
): ParametricNode<TParams> {
  return {
    name,
    params,
    run: (context, image) => run(context, image, params),
  };
}

/**
 * Creates a masked node that only processes selected pixels.
 */
export function createMaskedNode(
  node: ImageNode,
  selector: PixelSelector,
  options: SelectionOptions = {}
): ImageNode {
  return {
    name: `${node.name}-masked`,
    params: { node: node.name, options },
    run: async (context, image) => {
      const outside = toRgba(options.outsideColor ?? { r: 0, g: 0, b: 0, a: 0 });
      const mode = options.mode ?? 'clip';
      const mask = buildSelectionMask(image, selector, context);
      if (mode === 'preserve') {
        const result = await node.run(context, image);
        return mergeSelection(image, result, mask);
      }
      const maskedInput = applyMaskToImage(image, mask, outside);
      const result = await node.run(context, maskedInput);
      return applyMaskToImage(result, mask, outside);
    },
  };
}

/**
 * Creates a node that composites sources based on a color mask.
 */
export function createMaskMapNode(
  mask: MaskMapSource,
  entries: MaskMapEntry[],
  options: MaskMapOptions = {}
): ImageNode {
  return {
    name: 'mask-map',
    params: { entries, options },
    run: async (context, image) => {
      const base = image.format === 'rgba8' ? image : image.toFormat('rgba8');
      const maskImage = await resolveMaskSource(mask, context, base);
      const resizedMask =
        maskImage.width === base.width && maskImage.height === base.height
          ? maskImage
          : await resizeImage(maskImage, base.width, base.height, options.resize);
      const maskRgba = resizedMask.format === 'rgba8' ? resizedMask : resizedMask.toFormat('rgba8');
      const layers = await Promise.all(
        entries.map(async (entry) => {
          const source = entry.source ?? base;
          const resolved = await resolveMaskSource(source, context, base);
          const resized =
            resolved.width === base.width && resolved.height === base.height
              ? resolved
              : await resizeImage(resolved, base.width, base.height, options.resize);
          const rgba = resized.format === 'rgba8' ? resized : resized.toFormat('rgba8');
          return {
            color: toRgba(entry.color),
            tolerance: Math.max(0, entry.tolerance ?? 0),
            image: rgba,
          };
        })
      );
      const output = mapMaskComposite(base, maskRgba, layers, options.defaultColor);
      if (image.format === 'rgba8') {
        return output;
      }
      return output.toFormat(image.format);
    },
  };
}

/**
 * Creates a node that removes pixels outside the selection.
 */
export function createSelectionCropNode(
  selector: PixelSelector,
  options: SelectionOptions = {}
): ImageNode {
  return {
    name: 'selection-crop',
    params: { options },
    run: (context, image) => {
      const outside = toRgba(options.outsideColor ?? { r: 0, g: 0, b: 0, a: 0 });
      const mask = buildSelectionMask(image, selector, context);
      return applyMaskToImage(image, mask, outside);
    },
  };
}

/**
 * Creates a node that maps every pixel using a custom mapper.
 */
export function createMapNode(
  name: string,
  mapper: (pixel: Pixel, x: number, y: number, context: NodeContext) => PixelLike
): ImageNode {
  return {
    name,
    run: (context, image) => image.mapPixels((pixel, x, y) => mapper(pixel, x, y, context)),
  };
}

/**
 * Creates a node that fills the image with a single color.
 */
export function createFillNode(color: ColorInput): ImageNode {
  const rgba = toRgba(color);
  return {
    name: 'fill',
    run: (context, image) => {
      void context;
      const output = image.clone();
      output.fill(rgba);
      return output;
    },
  };
}

/**
 * Options for creating a noise node.
 */
export type NoiseOptions = {
  min?: number;
  max?: number;
  alpha?: number;
  grayscale?: boolean;
};

/**
 * Creates a node that applies seeded noise to every pixel.
 */
export function createNoiseNode(options: NoiseOptions = {}): ImageNode {
  const { min = 0, max = 255, alpha = 255, grayscale = true } = options;
  return {
    name: 'noise',
    run: (context, image) => {
      return image.mapPixels(() => {
        const r = context.random.nextInt(min, max);
        if (grayscale) {
          return { r, g: r, b: r, a: alpha };
        }
        return {
          r,
          g: context.random.nextInt(min, max),
          b: context.random.nextInt(min, max),
          a: alpha,
        };
      });
    },
  };
}

/**
 * Options for convolution nodes.
 */
export type ConvolutionOptions = {
  normalize?: boolean;
};

/**
 * Creates a convolution node using an odd square kernel.
 */
export function createConvolutionNode(
  name: string,
  kernel: number[][],
  options: ConvolutionOptions = {}
): ImageNode {
  const size = kernel.length;
  if (size === 0 || kernel.some((row) => row.length !== size) || size % 2 === 0) {
    throw new Error('Kernel must be a non-empty odd square matrix');
  }
  const radius = Math.floor(size / 2);
  const sum = kernel.flat().reduce((total, value) => total + value, 0);
  const normalize = options.normalize !== false;
  const divisor = normalize ? (sum === 0 ? 1 : sum) : 1;

  return {
    name,
    run: (context, image) => {
      void context;
      if (image.format === 'rgba8') {
        return convolveRgba8(image, kernel, divisor, radius);
      }
      const output = new ImageBuffer(image.width, image.height, image.format);
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          for (let ky = 0; ky < size; ky += 1) {
            for (let kx = 0; kx < size; kx += 1) {
              const weight = kernel[ky][kx];
              if (weight === 0) continue;
              const sx = clamp(x + kx - radius, 0, image.width - 1);
              const sy = clamp(y + ky - radius, 0, image.height - 1);
              const pixel = image.getPixel(sx, sy);
              r += pixel.r * weight;
              g += pixel.g * weight;
              b += pixel.b * weight;
              a += pixel.a * weight;
            }
          }
          output.setPixel(x, y, { r: r / divisor, g: g / divisor, b: b / divisor, a: a / divisor });
        }
      }
      return output;
    },
  };
}

/**
 * Creates a node that inverts RGB values.
 */
export function createInvertNode(): ImageNode {
  return createMapNode('invert', (pixel) => ({
    r: 255 - pixel.r,
    g: 255 - pixel.g,
    b: 255 - pixel.b,
    a: pixel.a,
  }));
}

/**
 * Creates a node that converts RGB to grayscale.
 */
export function createGrayscaleNode(): ImageNode {
  return createMapNode('grayscale', (pixel) => {
    const value = Math.round((pixel.r + pixel.g + pixel.b) / 3);
    return { r: value, g: value, b: value, a: pixel.a };
  });
}

/**
 * Creates a node that applies gamma correction.
 */
export function createGammaNode(gamma: number): ImageNode {
  const safeGamma = gamma > 0 ? gamma : 1;
  return createMapNode('gamma', (pixel) => ({
    r: applyGamma(pixel.r, safeGamma),
    g: applyGamma(pixel.g, safeGamma),
    b: applyGamma(pixel.b, safeGamma),
    a: pixel.a,
  }));
}

/**
 * Creates a node that shifts brightness by a delta.
 */
export function createBrightnessNode(delta: number): ImageNode {
  return createMapNode('brightness', (pixel) => ({
    r: clampByte(pixel.r + delta),
    g: clampByte(pixel.g + delta),
    b: clampByte(pixel.b + delta),
    a: pixel.a,
  }));
}

/**
 * Creates a node that adjusts contrast around the midtone.
 */
export function createContrastNode(factor: number): ImageNode {
  return createMapNode('contrast', (pixel) => ({
    r: clampByte((pixel.r - 128) * factor + 128),
    g: clampByte((pixel.g - 128) * factor + 128),
    b: clampByte((pixel.b - 128) * factor + 128),
    a: pixel.a,
  }));
}

/**
 * Creates a node that applies a binary threshold.
 */
export function createThresholdNode(threshold: number, low = 0, high = 255): ImageNode {
  const t = clampByte(threshold);
  const lowValue = clampByte(low);
  const highValue = clampByte(high);
  return createMapNode('threshold', (pixel) => {
    const value = Math.round((pixel.r + pixel.g + pixel.b) / 3);
    const next = value >= t ? highValue : lowValue;
    return { r: next, g: next, b: next, a: pixel.a };
  });
}

/**
 * Creates a node that fills the image with a random color.
 */
export function createRandomFillNode(alpha = 255): ImageNode {
  return {
    name: 'random-fill',
    run: (context, image) => {
      const color = {
        r: context.random.nextInt(0, 255),
        g: context.random.nextInt(0, 255),
        b: context.random.nextInt(0, 255),
        a: alpha,
      };
      const output = image.clone();
      output.fill(color);
      return output;
    },
  };
}

/**
 * Creates a node that adds Gaussian noise.
 */
export function createGaussianNoiseNode(
  mean = 0,
  stdDev = 12,
  alpha = 255,
  grayscale = false
): ImageNode {
  return {
    name: 'gaussian-noise',
    run: (context, image) => {
      return image.mapPixels((pixel) => {
        const n = context.random.nextGaussian(mean, stdDev);
        if (grayscale) {
          const value = clampByte(pixel.r + n);
          return { r: value, g: value, b: value, a: alpha };
        }
        return {
          r: clampByte(pixel.r + n),
          g: clampByte(pixel.g + n),
          b: clampByte(pixel.b + n),
          a: alpha,
        };
      });
    },
  };
}

/**
 * Creates a node that applies salt and pepper noise.
 */
export function createSaltPepperNoiseNode(
  probability = 0.02,
  salt: ColorInput = '#ffffff',
  pepper: ColorInput = '#000000'
): ImageNode {
  const saltRgba = toRgba(salt);
  const pepperRgba = toRgba(pepper);
  return {
    name: 'salt-pepper',
    run: (context, image) => {
      return image.mapPixels((pixel) => {
        const roll = context.random.next();
        if (roll < probability / 2) return pepperRgba;
        if (roll < probability) return saltRgba;
        return pixel;
      });
    },
  };
}

/**
 * Creates a checkerboard pattern node.
 */
export function createCheckerboardNode(
  tileSize: number,
  colorA: ColorInput,
  colorB: ColorInput
): ImageNode {
  const a = toRgba(colorA);
  const b = toRgba(colorB);
  const size = Math.max(1, Math.floor(tileSize));
  return {
    name: 'checkerboard',
    run: (context, image) => {
      void context;
      return image.mapPixels((_pixel, x, y) => {
        const index = (Math.floor(x / size) + Math.floor(y / size)) % 2;
        return index === 0 ? a : b;
      });
    },
  };
}

/**
 * Options for drawing a rectangle.
 */
export type RectOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: ColorInput;
};

/**
 * Creates a node that draws a rectangle.
 */
export function createRectNode(options: RectOptions): ImageNode {
  const color = toRgba(options.color);
  const selector = createRectSelector(options);
  return {
    name: 'rect',
    run: (context, image) => {
      const output = image.clone();
      const mask = buildSelectionMask(image, selector, context);
      applyColorMask(output, mask, color);
      return output;
    },
  };
}

/**
 * Options for drawing a circle.
 */
export type CircleOptions = {
  cx: number;
  cy: number;
  radius: number;
  color: ColorInput;
};

/**
 * Creates a node that draws a circle.
 */
export function createCircleNode(options: CircleOptions): ImageNode {
  const color = toRgba(options.color);
  const selector = createCircleSelector(options);
  return {
    name: 'circle',
    run: (context, image) => {
      const output = image.clone();
      const mask = buildSelectionMask(image, selector, context);
      applyColorMask(output, mask, color);
      return output;
    },
  };
}

/**
 * Creates a node that maps colors to the nearest palette entry.
 */
export function createPaletteMapNode(palette: ColorInput[]): ImageNode {
  const colors = palette.map((color) => toRgba(color));
  return {
    name: 'palette-map',
    run: (context, image) => {
      void context;
      return image.mapPixels((pixel) => {
        let best = colors[0];
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const color of colors) {
          const distance = colorDistance(pixel, color);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = color;
          }
        }
        return best;
      });
    },
  };
}

/**
 * Builds a normalized box kernel.
 */
export function buildBoxKernel(size: number): number[][] {
  const dimension = size % 2 === 0 ? size + 1 : size;
  const value = 1;
  return Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => value));
}

/**
 * Builds a Gaussian kernel with the given size and sigma.
 */
export function buildGaussianKernel(size: number, sigma = 1.5): number[][] {
  const dimension = size % 2 === 0 ? size + 1 : size;
  const radius = Math.floor(dimension / 2);
  const kernel: number[][] = [];
  const twoSigma2 = 2 * sigma * sigma;
  for (let y = -radius; y <= radius; y += 1) {
    const row: number[] = [];
    for (let x = -radius; x <= radius; x += 1) {
      const value = Math.exp(-(x * x + y * y) / twoSigma2);
      row.push(value);
    }
    kernel.push(row);
  }
  return kernel;
}

/**
 * Creates a Gaussian blur node.
 */
export function createGaussianBlurNode(size = 9, sigma = 2): ImageNode {
  return {
    name: 'gaussian-blur',
    params: { size, sigma },
    run: (context, image) => {
      void context;
      if (image.format !== 'rgba8') {
        return createConvolutionNode('gaussian-blur', buildGaussianKernel(size, sigma)).run(
          context,
          image
        );
      }
      return gaussianBlurRgba8(image, size, sigma);
    },
  };
}

/**
 * Creates a sharpening node.
 */
export function createSharpenNode(): ImageNode {
  return createConvolutionNode('sharpen', [
    [0, -1, 0],
    [-1, 5, -1],
    [0, -1, 0],
  ]);
}

/**
 * Creates an edge detection node.
 */
export function createEdgeDetectNode(): ImageNode {
  return createConvolutionNode('edge-detect', [
    [-1, -1, -1],
    [-1, 8, -1],
    [-1, -1, -1],
  ]);
}

/**
 * Creates a node that resizes the image to the target dimensions.
 */
export function createResizeNode(
  width: number,
  height: number,
  options: ResizeOptions = {}
): ImageNode {
  return {
    name: 'resize',
    params: { width, height, options },
    run: async (context, image) => {
      void context;
      return resizeImage(image, width, height, options);
    },
  };
}

function buildSelectionMask(
  image: ImageBuffer,
  selector: PixelSelector,
  context: NodeContext
): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  let index = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = image.getPixel(x, y);
      mask[index] = selector(pixel, x, y, context) ? 1 : 0;
      index += 1;
    }
  }
  return mask;
}

function applyMaskToImage(image: ImageBuffer, mask: Uint8Array, outside: PixelLike): ImageBuffer {
  const output = image.clone();
  let index = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (mask[index] === 0) {
        output.setPixel(x, y, outside);
      }
      index += 1;
    }
  }
  return output;
}

function mergeSelection(image: ImageBuffer, result: ImageBuffer, mask: Uint8Array): ImageBuffer {
  const output = image.clone();
  let index = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (mask[index] === 1) {
        output.setPixel(x, y, result.getPixel(x, y));
      }
      index += 1;
    }
  }
  return output;
}

function applyColorMask(image: ImageBuffer, mask: Uint8Array, color: PixelLike): void {
  let index = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (mask[index] === 1) {
        image.setPixel(x, y, color);
      }
      index += 1;
    }
  }
}

function resolveMaskSource(
  source: MaskMapSource,
  context: NodeContext,
  base: ImageBuffer
): Promise<ImageBuffer> | ImageBuffer {
  if (source instanceof ImageBuffer) {
    return source;
  }
  if (isImageNode(source)) {
    return source.run(context, base);
  }
  return loadImage(source);
}

function isImageNode(value: MaskMapSource): value is ImageNode {
  return typeof (value as ImageNode).run === 'function';
}

function mapMaskComposite(
  base: ImageBuffer,
  mask: ImageBuffer,
  layers: { color: Pixel; tolerance: number; image: ImageBuffer }[],
  defaultColor?: ColorInput
): ImageBuffer {
  const width = base.width;
  const height = base.height;
  const output = new ImageBuffer(width, height, 'rgba8');
  const baseData = base.data as Uint8Array;
  const maskData = mask.data as Uint8Array;
  const outData = output.data as Uint8Array;
  const defaultPixel = defaultColor ? toRgba(defaultColor) : null;
  const layerData = layers.map((layer) => ({
    color: layer.color,
    tolerance2: layer.tolerance * layer.tolerance,
    data: layer.image.data as Uint8Array,
  }));
  for (let i = 0; i < outData.length; i += 4) {
    const mr = maskData[i];
    const mg = maskData[i + 1];
    const mb = maskData[i + 2];
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let j = 0; j < layerData.length; j += 1) {
      const layer = layerData[j];
      const dr = mr - layer.color.r;
      const dg = mg - layer.color.g;
      const db = mb - layer.color.b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance <= layer.tolerance2 && distance < bestDistance) {
        bestDistance = distance;
        bestIndex = j;
      }
    }
    if (bestIndex >= 0) {
      const src = layerData[bestIndex].data;
      outData[i] = src[i];
      outData[i + 1] = src[i + 1];
      outData[i + 2] = src[i + 2];
      outData[i + 3] = src[i + 3];
      continue;
    }
    if (defaultPixel) {
      outData[i] = defaultPixel.r;
      outData[i + 1] = defaultPixel.g;
      outData[i + 2] = defaultPixel.b;
      outData[i + 3] = defaultPixel.a;
      continue;
    }
    outData[i] = baseData[i];
    outData[i + 1] = baseData[i + 1];
    outData[i + 2] = baseData[i + 2];
    outData[i + 3] = baseData[i + 3];
  }
  return output;
}

function convolveRgba8(
  image: ImageBuffer,
  kernel: number[][],
  divisor: number,
  radius: number
): ImageBuffer {
  const width = image.width;
  const height = image.height;
  const output = new ImageBuffer(width, height, 'rgba8');
  const data = image.data as Uint8Array;
  const out = output.data as Uint8Array;
  const size = kernel.length;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let ky = 0; ky < size; ky += 1) {
        const sy = clamp(y + ky - radius, 0, height - 1);
        for (let kx = 0; kx < size; kx += 1) {
          const weight = kernel[ky][kx];
          if (weight === 0) continue;
          const sx = clamp(x + kx - radius, 0, width - 1);
          const index = (sy * width + sx) * 4;
          r += data[index] * weight;
          g += data[index + 1] * weight;
          b += data[index + 2] * weight;
          a += data[index + 3] * weight;
        }
      }
      const outIndex = (y * width + x) * 4;
      out[outIndex] = clampByte(r / divisor);
      out[outIndex + 1] = clampByte(g / divisor);
      out[outIndex + 2] = clampByte(b / divisor);
      out[outIndex + 3] = clampByte(a / divisor);
    }
  }
  return output;
}

function gaussianBlurRgba8(image: ImageBuffer, size: number, sigma: number): ImageBuffer {
  const dimension = size % 2 === 0 ? size + 1 : size;
  const radius = Math.floor(dimension / 2);
  const kernel = buildGaussianKernel1D(dimension, sigma);
  const width = image.width;
  const height = image.height;
  const data = image.data as Uint8Array;
  const temp = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sx = clamp(x + k, 0, width - 1);
        const weight = kernel[k + radius];
        const index = (y * width + sx) * 4;
        r += data[index] * weight;
        g += data[index + 1] * weight;
        b += data[index + 2] * weight;
        a += data[index + 3] * weight;
      }
      const outIndex = (y * width + x) * 4;
      temp[outIndex] = r;
      temp[outIndex + 1] = g;
      temp[outIndex + 2] = b;
      temp[outIndex + 3] = a;
    }
  }
  const output = new ImageBuffer(width, height, 'rgba8');
  const out = output.data as Uint8Array;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const sy = clamp(y + k, 0, height - 1);
        const weight = kernel[k + radius];
        const index = (sy * width + x) * 4;
        r += temp[index] * weight;
        g += temp[index + 1] * weight;
        b += temp[index + 2] * weight;
        a += temp[index + 3] * weight;
      }
      const outIndex = (y * width + x) * 4;
      out[outIndex] = clampByte(r);
      out[outIndex + 1] = clampByte(g);
      out[outIndex + 2] = clampByte(b);
      out[outIndex + 3] = clampByte(a);
    }
  }
  return output;
}

function buildGaussianKernel1D(size: number, sigma: number): number[] {
  const radius = Math.floor(size / 2);
  const kernel: number[] = [];
  const sigmaValue = sigma <= 0 ? 1 : sigma;
  const twoSigma2 = 2 * sigmaValue * sigmaValue;
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    const value = Math.exp(-(i * i) / twoSigma2);
    kernel.push(value);
    sum += value;
  }
  return kernel.map((value) => value / sum);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function applyGamma(value: number, gamma: number): number {
  const normalized = clamp(value, 0, 255) / 255;
  return Math.round(Math.pow(normalized, gamma) * 255);
}
