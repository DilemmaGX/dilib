import { ImageBuffer } from './image';
import { ColorInput, colorDistance, toRgba } from './color';
import { ImageSource, Pixel, PixelLike } from './types';
import { SeededRandom } from './random';
import { loadImage, ResizeOptions, resizeImage, renderText, type TextOptions } from './sources';

export const DEFAULT_IMAGE_KEY = 'image';

/**
 * Runtime context shared across nodes in a pipeline run.
 */
export type NodeContext = {
  random: SeededRandom;
  stash: Map<string, unknown>;
};

/**
 * State passed between nodes in a pipeline run.
 */
export type NodeState = {
  images: Record<string, ImageBuffer>;
  data: Record<string, unknown>;
};

/**
 * Result returned by a node execution.
 */
export type NodeResult = {
  images?: Record<string, ImageBuffer>;
  data?: Record<string, unknown>;
};

type NodeRunner<TParams> = {
  bivarianceHack(
    context: NodeContext,
    state: NodeState,
    params: TParams
  ): Promise<NodeResult> | NodeResult;
}['bivarianceHack'];

/**
 * Pipeline node definition.
 */
export type NodeDefinition<TParams = unknown> = {
  name: string;
  params?: TParams;
  inputs?: string[];
  outputs?: string[];
  run: NodeRunner<TParams>;
};

/**
 * Alias for image-focused nodes.
 */
export type ImageNode<TParams = unknown> = NodeDefinition<TParams>;

/**
 * Image node with typed parameters metadata.
 */
export type ParametricNode<TParams> = ImageNode<TParams> & { params: TParams };

/**
 * Definition for a reusable node.
 */
export function defineNode<TParams>(definition: NodeDefinition<TParams>): NodeDefinition<TParams> {
  return definition;
}

/**
 * Image node input definition.
 */
export type ImageNodeOptions = {
  input?: string;
  output?: string;
};

/**
 * 2D pixel matrix representation.
 */
export type PixelMatrix = Pixel[][];

/**
 * Context provided to pixel-based node handlers.
 */
export type PixelNodeInfo<TParams> = {
  context: NodeContext;
  image: ImageBuffer;
  state: NodeState;
  params: TParams;
  width: number;
  height: number;
};

/**
 * Handler signature for pixel-based nodes.
 */
export type PixelNodeRunner<TParams> = (
  pixels: PixelMatrix,
  info: PixelNodeInfo<TParams>
) => PixelMatrix | ImageBuffer | Promise<PixelMatrix | ImageBuffer>;

/**
 * Simplified node definition.
 */
export type SimpleNodeDefinition<TParams> = {
  name?: string;
  params?: TParams;
  input?: string;
  output?: string;
  run: PixelNodeRunner<TParams>;
};

/**
 * Creates a node that reads a single image key and writes a single image key.
 */
export function createImageNode<TParams>(
  name: string,
  params: TParams,
  run: (
    context: NodeContext,
    image: ImageBuffer,
    params: TParams,
    state: NodeState
  ) => Promise<ImageBuffer> | ImageBuffer,
  options: ImageNodeOptions = {}
): ImageNode<TParams> {
  const inputKey = options.input ?? DEFAULT_IMAGE_KEY;
  const outputKey = options.output ?? DEFAULT_IMAGE_KEY;
  return defineNode({
    name,
    params,
    inputs: [inputKey],
    outputs: [outputKey],
    run: async (context, state, resolvedParams) => {
      const image = getImage(state, inputKey);
      const output = await run(context, image, resolvedParams, state);
      return { images: { [outputKey]: output } };
    },
  });
}

let nodeCounter = 0;

function nextNodeName(): string {
  nodeCounter += 1;
  return `node-${nodeCounter}`;
}

/**
 * Creates a node that operates on a 2D pixel matrix.
 */
export function createPixelNode<TParams>(
  name: string,
  params: TParams,
  run: PixelNodeRunner<TParams>,
  options: ImageNodeOptions = {}
): ImageNode<TParams> {
  return createImageNode(
    name,
    params,
    async (context, image, resolvedParams, state) => {
      const pixels = image.toMatrix();
      const result = await run(pixels, {
        context,
        image,
        state,
        params: resolvedParams,
        width: image.width,
        height: image.height,
      });
      if (result instanceof ImageBuffer) {
        return result;
      }
      return ImageBuffer.fromMatrix(result, image.format);
    },
    options
  );
}

/**
 * Creates a simplified pixel-based node with optional name and parameters.
 */
export function node<TParams>(definition: SimpleNodeDefinition<TParams>): ImageNode<TParams> {
  const name = definition.name ?? nextNodeName();
  const params = (definition.params ?? ({} as TParams)) as TParams;
  return createPixelNode(name, params, definition.run, {
    input: definition.input,
    output: definition.output,
  });
}

/**
 * Returns the image associated with the given key.
 */
export function getImage(state: NodeState, key: string = DEFAULT_IMAGE_KEY): ImageBuffer {
  const image = state.images[key];
  if (!image) {
    throw new Error(`Missing image input: ${key}`);
  }
  return image;
}

/**
 * Merges a node result into a state snapshot.
 */
export function mergeNodeState(state: NodeState, result: NodeResult): NodeState {
  return {
    images: { ...state.images, ...(result.images ?? {}) },
    data: { ...state.data, ...(result.data ?? {}) },
  };
}

/**
 * Runs a node and returns its raw result.
 */
export async function runNode(
  node: ImageNode,
  context: NodeContext,
  state: NodeState
): Promise<NodeResult> {
  return node.run(context, state, node.params as never);
}

/**
 * Runs a node and returns a single image output.
 */
export async function runNodeImage(
  node: ImageNode,
  context: NodeContext,
  state: NodeState,
  outputKey: string = node.outputs?.[0] ?? DEFAULT_IMAGE_KEY
): Promise<ImageBuffer> {
  const result = await runNode(node, context, state);
  const output = result.images?.[outputKey];
  if (!output) {
    throw new Error(`Missing node output image: ${outputKey}`);
  }
  return output;
}

/**
 * Selector used to choose pixels for masked execution.
 */
export type PixelSelector = ((
  pixel: Pixel,
  x: number,
  y: number,
  context: NodeContext
) => boolean) & {
  prepare?: (image: ImageBuffer, context: NodeContext) => Uint8Array;
};

/**
 * Masking options for nodes.
 */
export type SelectionOptions = {
  mode?: SelectionMode;
  outsideColor?: ColorInput;
};

/**
 * Masking mode for selection.
 */
export type SelectionMode = 'preserve' | 'clip';

/**
 * Image source input accepted by nodes.
 */
export type ImageInput = ImageSource | ImageBuffer | ImageNode;

/**
 * Mask source for color mapping.
 */
export type MaskMapSource = ImageInput;

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
 * Options for alpha-boundary stroke nodes.
 */
export type AlphaStrokeOptions = {
  alphaThreshold?: number;
  thickness?: number;
  color?: ColorInput;
  connectivity?: 4 | 8;
};

/**
 * Options for contrast-boundary stroke nodes.
 */
export type ContrastStrokeOptions = {
  threshold?: number;
  thickness?: number;
  color?: ColorInput;
  connectivity?: 4 | 8;
};

/**
 * Options for alpha-boundary selectors.
 */
export type AlphaStrokeSelectorOptions = {
  alphaThreshold?: number;
  thickness?: number;
  mode?: 'stroke' | 'shape';
  connectivity?: 4 | 8;
};

/**
 * Options for contrast-boundary selectors.
 */
export type ContrastStrokeSelectorOptions = {
  threshold?: number;
  thickness?: number;
  mode?: 'stroke' | 'shape';
  connectivity?: 4 | 8;
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
 * Creates an alpha-boundary selector.
 */
export function createAlphaStrokeSelector(options: AlphaStrokeSelectorOptions = {}): PixelSelector {
  const { alphaThreshold = 1, thickness = 1, mode = 'stroke', connectivity = 8 } = options;
  const normalizedThreshold = clampByte(alphaThreshold);
  const normalizedThickness = Math.max(1, Math.floor(thickness));
  const normalizedConnectivity = connectivity === 4 ? 4 : 8;
  const selector = ((pixel) =>
    mode === 'shape' ? pixel.a >= normalizedThreshold : false) as PixelSelector;
  selector.prepare = (image) => {
    const rgba = image.format === 'rgba8' ? image : image.toFormat('rgba8');
    if (mode === 'shape') {
      return computeAlphaMask(rgba, normalizedThreshold);
    }
    return computeAlphaStrokeMask(
      rgba,
      normalizedThreshold,
      normalizedThickness,
      normalizedConnectivity
    );
  };
  return selector;
}

/**
 * Creates a contrast-boundary selector.
 */
export function createContrastStrokeSelector(
  options: ContrastStrokeSelectorOptions = {}
): PixelSelector {
  const { threshold = 32, thickness = 1, mode = 'stroke', connectivity = 8 } = options;
  const normalizedThreshold = Math.max(0, threshold);
  const normalizedThickness = Math.max(1, Math.floor(thickness));
  const normalizedConnectivity = connectivity === 4 ? 4 : 8;
  const selector = (() => false) as PixelSelector;
  selector.prepare = (image) => {
    const rgba = image.format === 'rgba8' ? image : image.toFormat('rgba8');
    if (mode === 'shape') {
      return computeContrastShapeMask(rgba, normalizedThreshold, normalizedConnectivity);
    }
    return computeContrastStrokeMask(
      rgba,
      normalizedThreshold,
      normalizedThickness,
      normalizedConnectivity
    );
  };
  return selector;
}

/**
 * Creates a node with typed parameters stored in the node metadata.
 */
export function createParamNode<TParams>(
  name: string,
  params: TParams,
  run: (context: NodeContext, image: ImageBuffer, params: TParams) => ImageBuffer
): ParametricNode<TParams> {
  return createImageNode(name, params, (context, image, resolvedParams) =>
    run(context, image, resolvedParams)
  ) as ParametricNode<TParams>;
}

/**
 * Creates a masked node that only processes selected pixels.
 */
export function createMaskedNode(
  node: ImageNode,
  selector: PixelSelector,
  options: SelectionOptions = {},
  io: ImageNodeOptions = {}
): ImageNode {
  const inputKey = io.input ?? DEFAULT_IMAGE_KEY;
  const outputKey = io.output ?? DEFAULT_IMAGE_KEY;
  return defineNode({
    name: `${node.name}-masked`,
    params: { node: node.name, options },
    inputs: [inputKey],
    outputs: [outputKey],
    run: async (context, state) => {
      const base = getImage(state, inputKey);
      const outside = toRgba(options.outsideColor ?? { r: 0, g: 0, b: 0, a: 0 });
      const mode = options.mode ?? 'clip';
      const mask = buildSelectionMask(base, selector, context);
      if (mode === 'preserve') {
        const innerState = withImage(state, inputKey, base);
        const result = await runNodeImage(node, context, innerState, outputKey);
        return { images: { [outputKey]: mergeSelection(base, result, mask) } };
      }
      const maskedInput = applyMaskToImage(base, mask, outside);
      const innerState = withImage(state, inputKey, maskedInput);
      const result = await runNodeImage(node, context, innerState, outputKey);
      return { images: { [outputKey]: applyMaskToImage(result, mask, outside) } };
    },
  });
}

/**
 * Creates a node that composites sources based on a color mask.
 */
export function createMaskMapNode(
  mask: MaskMapSource,
  entries: MaskMapEntry[],
  options: MaskMapOptions = {}
): ImageNode {
  return createImageNode(
    'mask-map',
    { entries, options },
    async (context, image, params, state) => {
      const base = image.format === 'rgba8' ? image : image.toFormat('rgba8');
      const maskImage = await resolveImageInput(mask, context, state);
      const resizedMask =
        maskImage.width === base.width && maskImage.height === base.height
          ? maskImage
          : await resizeImage(maskImage, base.width, base.height, params.options.resize);
      const maskRgba = resizedMask.format === 'rgba8' ? resizedMask : resizedMask.toFormat('rgba8');
      const layers = await Promise.all(
        params.entries.map(async (entry) => {
          const source = entry.source ?? base;
          const resolved = await resolveImageInput(source, context, state);
          const resized =
            resolved.width === base.width && resolved.height === base.height
              ? resolved
              : await resizeImage(resolved, base.width, base.height, params.options.resize);
          const rgba = resized.format === 'rgba8' ? resized : resized.toFormat('rgba8');
          return {
            color: toRgba(entry.color),
            tolerance: Math.max(0, entry.tolerance ?? 0),
            image: rgba,
          };
        })
      );
      const output = mapMaskComposite(base, maskRgba, layers, params.options.defaultColor);
      return image.format === 'rgba8' ? output : output.toFormat(image.format);
    }
  );
}

/**
 * Creates a node that removes pixels outside the selection.
 */
export function createSelectionCropNode(
  selector: PixelSelector,
  options: SelectionOptions = {}
): ImageNode {
  return createImageNode('selection-crop', { options }, (context, image) => {
    const outside = toRgba(options.outsideColor ?? { r: 0, g: 0, b: 0, a: 0 });
    const mask = buildSelectionMask(image, selector, context);
    return applyMaskToImage(image, mask, outside);
  });
}

/**
 * Creates a node that draws a stroke along alpha boundaries.
 */
export function createAlphaStrokeNode(options: AlphaStrokeOptions = {}): ImageNode {
  const { alphaThreshold = 1, thickness = 1, color = '#000000', connectivity = 8 } = options;
  const normalizedThreshold = clampByte(alphaThreshold);
  const normalizedThickness = Math.max(1, Math.floor(thickness));
  const normalizedConnectivity = connectivity === 4 ? 4 : 8;
  const stroke = toRgba(color);
  return createImageNode(
    'alpha-stroke',
    { alphaThreshold, thickness, color, connectivity: normalizedConnectivity },
    (_context, image) => {
      const base = image.format === 'rgba8' ? image : image.toFormat('rgba8');
      const mask = computeAlphaStrokeMask(
        base,
        normalizedThreshold,
        normalizedThickness,
        normalizedConnectivity
      );
      const output = base.clone();
      applyColorMask(output, mask, stroke);
      return image.format === 'rgba8' ? output : output.toFormat(image.format);
    }
  );
}

/**
 * Creates a node that draws a stroke along contrast boundaries.
 */
export function createContrastStrokeNode(options: ContrastStrokeOptions = {}): ImageNode {
  const { threshold = 32, thickness = 1, color = '#000000', connectivity = 8 } = options;
  const normalizedThreshold = Math.max(0, threshold);
  const normalizedThickness = Math.max(1, Math.floor(thickness));
  const normalizedConnectivity = connectivity === 4 ? 4 : 8;
  const stroke = toRgba(color);
  return createImageNode(
    'contrast-stroke',
    { threshold, thickness, color, connectivity: normalizedConnectivity },
    (_context, image) => {
      const base = image.format === 'rgba8' ? image : image.toFormat('rgba8');
      const mask = computeContrastStrokeMask(
        base,
        normalizedThreshold,
        normalizedThickness,
        normalizedConnectivity
      );
      const output = base.clone();
      applyColorMask(output, mask, stroke);
      return image.format === 'rgba8' ? output : output.toFormat(image.format);
    }
  );
}

/**
 * Creates a node that maps every pixel using a custom mapper.
 */
export function createMapNode(
  name: string,
  mapper: (pixel: Pixel, x: number, y: number, context: NodeContext) => PixelLike
): ImageNode {
  return createImageNode(name, { mapper: 'custom' }, (context, image) =>
    image.mapPixels((pixel, x, y) => mapper(pixel, x, y, context))
  );
}

/**
 * Creates a node that fills the image with a single color.
 */
export function createFillNode(color: ColorInput): ImageNode {
  const rgba = toRgba(color);
  return createImageNode('fill', { color }, (_context, image) => {
    const output = image.clone();
    output.fill(rgba);
    return output;
  });
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
 * Options for creating a value noise node.
 */
export type ValueNoiseOptions = {
  scale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  min?: number;
  max?: number;
  alpha?: number;
};

/**
 * Options for creating a Voronoi noise node.
 */
export type VoronoiNoiseOptions = {
  scale?: number;
  jitter?: number;
  min?: number;
  max?: number;
  alpha?: number;
  mode?: 'distance' | 'edge';
};

/**
 * Options for creating a fractal noise node.
 */
export type FractalNoiseOptions = {
  scale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  min?: number;
  max?: number;
  alpha?: number;
};

/**
 * Options for creating a Perlin noise node.
 */
export type PerlinNoiseOptions = {
  scale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  min?: number;
  max?: number;
  alpha?: number;
};

/**
 * Options for creating a turbulence noise node.
 */
export type TurbulenceNoiseOptions = {
  scale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  min?: number;
  max?: number;
  alpha?: number;
};

/**
 * Options for creating a ridged noise node.
 */
export type RidgedNoiseOptions = {
  scale?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  min?: number;
  max?: number;
  alpha?: number;
};

/**
 * Creates a node that applies seeded noise to every pixel.
 */
export function createNoiseNode(options: NoiseOptions = {}): ImageNode {
  const { min = 0, max = 255, alpha = 255, grayscale = true } = options;
  return createImageNode('noise', { min, max, alpha, grayscale }, (context, image) =>
    image.mapPixels(() => {
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
    })
  );
}

/**
 * Creates a node that generates value noise.
 */
export function createValueNoiseNode(options: ValueNoiseOptions = {}): ImageNode {
  const {
    scale = 24,
    octaves = 1,
    persistence = 0.5,
    lacunarity = 2,
    min = 0,
    max = 255,
    alpha = 255,
  } = options;
  return createImageNode('value-noise', options, (context, image) => {
    const seed = ensureSeed(context);
    const output = image.clone();
    const data = output.data as Uint8Array;
    const width = output.width;
    const height = output.height;
    let index = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = fractalValueNoise(x, y, seed, scale, octaves, persistence, lacunarity);
        const mapped = Math.round(min + (max - min) * value);
        data[index] = mapped;
        data[index + 1] = mapped;
        data[index + 2] = mapped;
        data[index + 3] = alpha;
        index += 4;
      }
    }
    return output;
  });
}

/**
 * Creates a node that generates Voronoi noise.
 */
export function createVoronoiNoiseNode(options: VoronoiNoiseOptions = {}): ImageNode {
  const { scale = 24, jitter = 0.75, min = 0, max = 255, alpha = 255, mode = 'distance' } = options;
  return createImageNode('voronoi-noise', options, (context, image) => {
    const seed = ensureSeed(context);
    const output = image.clone();
    const data = output.data as Uint8Array;
    const width = output.width;
    const height = output.height;
    const cell = Math.max(1, scale);
    let index = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const gx = Math.floor(x / cell);
        const gy = Math.floor(y / cell);
        let best = Number.POSITIVE_INFINITY;
        let second = Number.POSITIVE_INFINITY;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const cx = gx + ox;
            const cy = gy + oy;
            const rx = hash2D(cx, cy, seed);
            const ry = hash2D(cx + 7, cy + 13, seed);
            const px = (cx + rx * jitter) * cell;
            const py = (cy + ry * jitter) * cell;
            const dx = x - px;
            const dy = y - py;
            const dist = dx * dx + dy * dy;
            if (dist < best) {
              second = best;
              best = dist;
            } else if (dist < second) {
              second = dist;
            }
          }
        }
        const maxDist = cell * cell * 2;
        const value =
          mode === 'edge' ? clamp01((second - best) / maxDist) : clamp01(1 - best / maxDist);
        const mapped = Math.round(min + (max - min) * value);
        data[index] = mapped;
        data[index + 1] = mapped;
        data[index + 2] = mapped;
        data[index + 3] = alpha;
        index += 4;
      }
    }
    return output;
  });
}

/**
 * Creates a node that generates fractal value noise.
 */
export function createFractalNoiseNode(options: FractalNoiseOptions = {}): ImageNode {
  const {
    scale = 32,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2,
    min = 0,
    max = 255,
    alpha = 255,
  } = options;
  return createImageNode('fractal-noise', options, (context, image) => {
    const seed = ensureSeed(context);
    const output = image.clone();
    const data = output.data as Uint8Array;
    const width = output.width;
    const height = output.height;
    let index = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = fractalValueNoise(x, y, seed, scale, octaves, persistence, lacunarity);
        const mapped = Math.round(min + (max - min) * value);
        data[index] = mapped;
        data[index + 1] = mapped;
        data[index + 2] = mapped;
        data[index + 3] = alpha;
        index += 4;
      }
    }
    return output;
  });
}

/**
 * Creates a node that generates Perlin noise.
 */
export function createPerlinNoiseNode(options: PerlinNoiseOptions = {}): ImageNode {
  const {
    scale = 32,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2,
    min = 0,
    max = 255,
    alpha = 255,
  } = options;
  return createImageNode('perlin-noise', options, (context, image) => {
    const seed = ensureSeed(context);
    const output = image.clone();
    const data = output.data as Uint8Array;
    const width = output.width;
    const height = output.height;
    let index = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = fractalPerlinNoise(x, y, seed, scale, octaves, persistence, lacunarity);
        const mapped = Math.round(min + (max - min) * value);
        data[index] = mapped;
        data[index + 1] = mapped;
        data[index + 2] = mapped;
        data[index + 3] = alpha;
        index += 4;
      }
    }
    return output;
  });
}

/**
 * Creates a node that generates turbulence noise.
 */
export function createTurbulenceNoiseNode(options: TurbulenceNoiseOptions = {}): ImageNode {
  const {
    scale = 32,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2,
    min = 0,
    max = 255,
    alpha = 255,
  } = options;
  return createImageNode('turbulence-noise', options, (context, image) => {
    const seed = ensureSeed(context);
    const output = image.clone();
    const data = output.data as Uint8Array;
    const width = output.width;
    const height = output.height;
    let index = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = fractalTurbulenceNoise(x, y, seed, scale, octaves, persistence, lacunarity);
        const mapped = Math.round(min + (max - min) * value);
        data[index] = mapped;
        data[index + 1] = mapped;
        data[index + 2] = mapped;
        data[index + 3] = alpha;
        index += 4;
      }
    }
    return output;
  });
}

/**
 * Creates a node that generates ridged noise.
 */
export function createRidgedNoiseNode(options: RidgedNoiseOptions = {}): ImageNode {
  const {
    scale = 32,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2,
    min = 0,
    max = 255,
    alpha = 255,
  } = options;
  return createImageNode('ridged-noise', options, (context, image) => {
    const seed = ensureSeed(context);
    const output = image.clone();
    const data = output.data as Uint8Array;
    const width = output.width;
    const height = output.height;
    let index = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = fractalRidgedNoise(x, y, seed, scale, octaves, persistence, lacunarity);
        const mapped = Math.round(min + (max - min) * value);
        data[index] = mapped;
        data[index + 1] = mapped;
        data[index + 2] = mapped;
        data[index + 3] = alpha;
        index += 4;
      }
    }
    return output;
  });
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

  return createImageNode(name, { kernel, normalize }, (_context, image) => {
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
  });
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
  return createImageNode('random-fill', { alpha }, (context, image) => {
    const color = {
      r: context.random.nextInt(0, 255),
      g: context.random.nextInt(0, 255),
      b: context.random.nextInt(0, 255),
      a: alpha,
    };
    const output = image.clone();
    output.fill(color);
    return output;
  });
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
  return createImageNode('gaussian-noise', { mean, stdDev, alpha, grayscale }, (context, image) =>
    image.mapPixels((pixel) => {
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
    })
  );
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
  return createImageNode('salt-pepper', { probability, salt, pepper }, (context, image) =>
    image.mapPixels((pixel) => {
      const roll = context.random.next();
      if (roll < probability / 2) return pepperRgba;
      if (roll < probability) return saltRgba;
      return pixel;
    })
  );
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
  return createImageNode('checkerboard', { tileSize: size, colorA, colorB }, (_context, image) =>
    image.mapPixels((_pixel, x, y) => {
      const index = (Math.floor(x / size) + Math.floor(y / size)) % 2;
      return index === 0 ? a : b;
    })
  );
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
  return createImageNode('rect', options, (context, image) => {
    const output = image.clone();
    const mask = buildSelectionMask(image, selector, context);
    applyColorMask(output, mask, color);
    return output;
  });
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
  return createImageNode('circle', options, (context, image) => {
    const output = image.clone();
    const mask = buildSelectionMask(image, selector, context);
    applyColorMask(output, mask, color);
    return output;
  });
}

/**
 * Creates a node that maps colors to the nearest palette entry.
 */
export function createPaletteMapNode(palette: ColorInput[]): ImageNode {
  const colors = palette.map((color) => toRgba(color));
  return createImageNode('palette-map', { palette }, (_context, image) =>
    image.mapPixels((pixel) => {
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
    })
  );
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
  return createImageNode('gaussian-blur', { size, sigma }, async (context, image) => {
    if (image.format !== 'rgba8') {
      const node = createConvolutionNode('gaussian-blur', buildGaussianKernel(size, sigma));
      const state: NodeState = { images: { [DEFAULT_IMAGE_KEY]: image }, data: {} };
      return runNodeImage(node, context, state);
    }
    return gaussianBlurRgba8(image, size, sigma);
  });
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
  return createImageNode('resize', { width, height, options }, async (_context, image) =>
    resizeImage(image, width, height, options)
  );
}

/**
 * Creates a node that renders text onto an image.
 */
export function createTextNode(options: TextOptions): ImageNode<TextOptions> {
  return createImageNode('text', options, async (_context, image, params) =>
    renderText(image, params)
  );
}

async function resolveImageInput(
  source: ImageInput,
  context: NodeContext,
  state: NodeState
): Promise<ImageBuffer> {
  if (source instanceof ImageBuffer) {
    return source;
  }
  if (isImageNode(source)) {
    return runNodeImage(source, context, state);
  }
  return loadImage(source);
}

function isImageNode(value: ImageInput): value is ImageNode {
  return typeof (value as ImageNode).run === 'function';
}

function withImage(state: NodeState, key: string, image: ImageBuffer): NodeState {
  return {
    images: { ...state.images, [key]: image },
    data: { ...state.data },
  };
}

/**
 * Neighbor offsets for 4-connected adjacency.
 */
const NEIGHBOR_OFFSETS_4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * Neighbor offsets for 8-connected adjacency.
 */
const NEIGHBOR_OFFSETS_8: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

/**
 * Returns neighbor offsets for the requested connectivity.
 */
function getNeighborOffsets(connectivity: 4 | 8): [number, number][] {
  return connectivity === 4 ? NEIGHBOR_OFFSETS_4 : NEIGHBOR_OFFSETS_8;
}

/**
 * Builds a binary mask for pixels with alpha above the threshold.
 */
function computeAlphaMask(image: ImageBuffer, alphaThreshold: number): Uint8Array {
  const total = image.width * image.height;
  const mask = new Uint8Array(total);
  const data = image.data as Uint8Array;
  for (let i = 0; i < total; i += 1) {
    mask[i] = data[i * 4 + 3] >= alphaThreshold ? 1 : 0;
  }
  return mask;
}

/**
 * Marks transparent pixels that touch opaque pixels as boundary candidates.
 */
function computeAlphaBoundaryMask(
  solidMask: Uint8Array,
  width: number,
  height: number,
  connectivity: 4 | 8
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const offsets = getNeighborOffsets(connectivity);
  let index = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (solidMask[index] === 0) {
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (solidMask[nidx] === 1) {
            mask[index] = 1;
            break;
          }
        }
      }
      index += 1;
    }
  }
  return mask;
}

/**
 * Expands a seed mask by a given thickness using BFS.
 */
function expandMask(
  seedMask: Uint8Array,
  width: number,
  height: number,
  thickness: number,
  connectivity: 4 | 8,
  allowedMask?: Uint8Array
): Uint8Array {
  const total = width * height;
  const maxDepth = Math.max(0, Math.floor(thickness) - 1);
  const output = new Uint8Array(total);
  const dist = new Int32Array(total);
  dist.fill(-1);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < total; i += 1) {
    if (seedMask[i] === 1) {
      output[i] = 1;
      dist[i] = 0;
      queue[tail] = i;
      tail += 1;
    }
  }
  if (maxDepth === 0) {
    return output;
  }
  const offsets = getNeighborOffsets(connectivity);
  while (head < tail) {
    const idx = queue[head];
    head += 1;
    const depth = dist[idx];
    if (depth >= maxDepth) continue;
    const x = idx % width;
    const y = Math.floor(idx / width);
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nidx = ny * width + nx;
      if (allowedMask && allowedMask[nidx] === 0) continue;
      if (dist[nidx] !== -1) continue;
      dist[nidx] = depth + 1;
      output[nidx] = 1;
      queue[tail] = nidx;
      tail += 1;
    }
  }
  return output;
}

/**
 * Builds a stroke mask on alpha boundaries that grows into transparent pixels.
 */
function computeAlphaStrokeMask(
  image: ImageBuffer,
  alphaThreshold: number,
  thickness: number,
  connectivity: 4 | 8
): Uint8Array {
  const solidMask = computeAlphaMask(image, alphaThreshold);
  const boundaryMask = computeAlphaBoundaryMask(solidMask, image.width, image.height, connectivity);
  if (thickness <= 1) {
    return boundaryMask;
  }
  const total = image.width * image.height;
  const transparentMask = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    transparentMask[i] = solidMask[i] === 0 ? 1 : 0;
  }
  return expandMask(
    boundaryMask,
    image.width,
    image.height,
    thickness,
    connectivity,
    transparentMask
  );
}

/**
 * Detects contrast edges and marks both sides of the boundary.
 */
function computeContrastEdgeMask(
  image: ImageBuffer,
  threshold: number,
  connectivity: 4 | 8
): Uint8Array {
  const width = image.width;
  const height = image.height;
  const total = width * height;
  const mask = new Uint8Array(total);
  const data = image.data as Uint8Array;
  const limit = threshold * threshold;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const base = idx * 4;
      const r = data[base];
      const g = data[base + 1];
      const b = data[base + 2];
      if (x + 1 < width) {
        const right = base + 4;
        const dr = r - data[right];
        const dg = g - data[right + 1];
        const db = b - data[right + 2];
        if (dr * dr + dg * dg + db * db >= limit) {
          mask[idx] = 1;
          mask[idx + 1] = 1;
        }
      }
      if (y + 1 < height) {
        const down = base + width * 4;
        const dr = r - data[down];
        const dg = g - data[down + 1];
        const db = b - data[down + 2];
        if (dr * dr + dg * dg + db * db >= limit) {
          mask[idx] = 1;
          mask[idx + width] = 1;
        }
      }
      if (connectivity === 8 && y + 1 < height) {
        if (x + 1 < width) {
          const downRight = base + width * 4 + 4;
          const dr = r - data[downRight];
          const dg = g - data[downRight + 1];
          const db = b - data[downRight + 2];
          if (dr * dr + dg * dg + db * db >= limit) {
            mask[idx] = 1;
            mask[idx + width + 1] = 1;
          }
        }
        if (x > 0) {
          const downLeft = base + width * 4 - 4;
          const dr = r - data[downLeft];
          const dg = g - data[downLeft + 1];
          const db = b - data[downLeft + 2];
          if (dr * dr + dg * dg + db * db >= limit) {
            mask[idx] = 1;
            mask[idx + width - 1] = 1;
          }
        }
      }
    }
  }
  return mask;
}

/**
 * Expands a contrast edge mask to the requested thickness.
 */
function computeContrastStrokeMask(
  image: ImageBuffer,
  threshold: number,
  thickness: number,
  connectivity: 4 | 8
): Uint8Array {
  const edgeMask = computeContrastEdgeMask(image, threshold, connectivity);
  if (thickness <= 1) {
    return edgeMask;
  }
  return expandMask(edgeMask, image.width, image.height, thickness, connectivity);
}

/**
 * Fills shapes inferred from contrast edges using scanline toggling.
 */
function computeContrastShapeMask(
  image: ImageBuffer,
  threshold: number,
  connectivity: 4 | 8
): Uint8Array {
  const edgeMask = computeContrastEdgeMask(image, threshold, connectivity);
  const width = image.width;
  const height = image.height;
  const total = width * height;
  const fill = new Uint8Array(total);
  for (let y = 0; y < height; y += 1) {
    let inside = false;
    let lastEdge = 0;
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const edge = edgeMask[idx];
      if (edge === 1 && lastEdge === 0) {
        inside = !inside;
      }
      lastEdge = edge;
      if (inside || edge === 1) {
        fill[idx] = 1;
      }
    }
  }
  return fill;
}

/**
 * Builds a selection mask, using a precomputed selector when available.
 */
function buildSelectionMask(
  image: ImageBuffer,
  selector: PixelSelector,
  context: NodeContext
): Uint8Array {
  if (typeof selector.prepare === 'function') {
    const prepared = selector.prepare(image, context);
    if (prepared.length !== image.width * image.height) {
      throw new Error('Selection mask size mismatch');
    }
    return prepared;
  }
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

function mapMaskComposite(
  base: ImageBuffer,
  mask: ImageBuffer,
  layers: { color: Pixel; tolerance: number; image: ImageBuffer }[],
  defaultColor?: ColorInput
): ImageBuffer {
  const output = new ImageBuffer(base.width, base.height, 'rgba8');
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function ensureSeed(context: NodeContext): number {
  const existing = context.stash.get('noiseSeed');
  if (typeof existing === 'number') {
    return existing;
  }
  const seed = context.random.nextInt(0, 0x7fffffff);
  context.stash.set('noiseSeed', seed);
  return seed;
}

function hash2D(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 144664877);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

function gradientFromHash(value: number): { x: number; y: number } {
  const angle = value * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function perlinNoise(x: number, y: number, seed: number, scale: number): number {
  const cell = Math.max(1, scale);
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const tx = (x - gx * cell) / cell;
  const ty = (y - gy * cell) / cell;
  const g00 = gradientFromHash(hash2D(gx, gy, seed));
  const g10 = gradientFromHash(hash2D(gx + 1, gy, seed));
  const g01 = gradientFromHash(hash2D(gx, gy + 1, seed));
  const g11 = gradientFromHash(hash2D(gx + 1, gy + 1, seed));
  const d00 = g00.x * tx + g00.y * ty;
  const d10 = g10.x * (tx - 1) + g10.y * ty;
  const d01 = g01.x * tx + g01.y * (ty - 1);
  const d11 = g11.x * (tx - 1) + g11.y * (ty - 1);
  const sx = smoothstep(tx);
  const sy = smoothstep(ty);
  const ix0 = lerp(d00, d10, sx);
  const ix1 = lerp(d01, d11, sx);
  return clamp01((lerp(ix0, ix1, sy) + 1) / 2);
}

function valueNoise(x: number, y: number, seed: number, scale: number): number {
  const cell = Math.max(1, scale);
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const tx = (x - gx * cell) / cell;
  const ty = (y - gy * cell) / cell;
  const v00 = hash2D(gx, gy, seed);
  const v10 = hash2D(gx + 1, gy, seed);
  const v01 = hash2D(gx, gy + 1, seed);
  const v11 = hash2D(gx + 1, gy + 1, seed);
  const sx = smoothstep(tx);
  const sy = smoothstep(ty);
  const ix0 = lerp(v00, v10, sx);
  const ix1 = lerp(v01, v11, sx);
  return lerp(ix0, ix1, sy);
}

function fractalPerlinNoise(
  x: number,
  y: number,
  seed: number,
  scale: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  const steps = Math.max(1, Math.floor(octaves));
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let max = 0;
  for (let i = 0; i < steps; i += 1) {
    const cell = Math.max(1, scale / frequency);
    total += perlinNoise(x, y, seed + i * 1013, cell) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return max === 0 ? 0 : total / max;
}

function fractalTurbulenceNoise(
  x: number,
  y: number,
  seed: number,
  scale: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  const steps = Math.max(1, Math.floor(octaves));
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let max = 0;
  for (let i = 0; i < steps; i += 1) {
    const cell = Math.max(1, scale / frequency);
    const base = perlinNoise(x, y, seed + i * 1013, cell);
    const value = Math.abs(base * 2 - 1);
    total += value * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return max === 0 ? 0 : total / max;
}

function fractalRidgedNoise(
  x: number,
  y: number,
  seed: number,
  scale: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  const steps = Math.max(1, Math.floor(octaves));
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let max = 0;
  for (let i = 0; i < steps; i += 1) {
    const cell = Math.max(1, scale / frequency);
    const base = perlinNoise(x, y, seed + i * 1013, cell);
    let value = 1 - Math.abs(base * 2 - 1);
    value *= value;
    total += value * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return max === 0 ? 0 : total / max;
}

function fractalValueNoise(
  x: number,
  y: number,
  seed: number,
  scale: number,
  octaves: number,
  persistence: number,
  lacunarity: number
): number {
  const steps = Math.max(1, Math.floor(octaves));
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let max = 0;
  for (let i = 0; i < steps; i += 1) {
    const cell = Math.max(1, scale / frequency);
    total += valueNoise(x, y, seed + i * 1013, cell) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return max === 0 ? 0 : total / max;
}
