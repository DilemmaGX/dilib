import { ImageBuffer } from './image';
import { ImageSource } from './types';
import { loadImage } from './sources';
import { createRandom, SeededRandom } from './random';
import {
  DEFAULT_IMAGE_KEY,
  ImageNode,
  NodeContext,
  NodeState,
  mergeNodeState,
  createMapNode,
  createNoiseNode,
} from './nodes';

/**
 * Options for running a pipeline.
 */
export type PipelineOptions = {
  seed?: number | string;
  random?: SeededRandom;
  data?: Record<string, unknown>;
};

/**
 * Supported inputs for running a pipeline.
 */
export type PipelineInput = ImageSource | ImageBuffer | NodeState;

/**
 * Sequential pipeline that runs image nodes in order.
 */
export class Pipeline {
  private nodes: ImageNode[];

  /**
   * Creates a new pipeline with optional initial nodes.
   */
  constructor(nodes: ImageNode[] = []) {
    this.nodes = [...nodes];
  }

  /**
   * Appends nodes to the pipeline.
   */
  add(...nodes: ImageNode[]): this {
    this.nodes.push(...nodes);
    return this;
  }

  /**
   * Executes the pipeline against an input source or buffer.
   */
  async run(input: PipelineInput, options: PipelineOptions = {}): Promise<ImageBuffer> {
    const state = await this.runState(input, options);
    const output = state.images[DEFAULT_IMAGE_KEY];
    if (!output) {
      throw new Error(`Missing output image: ${DEFAULT_IMAGE_KEY}`);
    }
    return output;
  }

  /**
   * Executes the pipeline and returns the full node state.
   */
  async runState(input: PipelineInput, options: PipelineOptions = {}): Promise<NodeState> {
    const context: NodeContext = {
      random: options.random ?? createRandom(options.seed),
      stash: new Map(),
    };
    let state = await normalizeInput(input, options.data);
    for (const node of this.nodes) {
      const result = await node.run(context, state, node.params as never);
      state = mergeNodeState(state, result);
    }
    return state;
  }
}

/**
 * Creates a small example pipeline for quick sanity checks.
 */
export function createExamplePipeline(): Pipeline {
  return new Pipeline([
    createNoiseNode({ grayscale: true }),
    createMapNode('invert', (pixel) => ({
      r: 255 - pixel.r,
      g: 255 - pixel.g,
      b: 255 - pixel.b,
      a: pixel.a,
    })),
  ]);
}

/**
 * Creates a pipeline with the provided nodes.
 */
export function pipeline(...nodes: ImageNode[]): Pipeline {
  return new Pipeline(nodes);
}

async function normalizeInput(
  input: PipelineInput,
  data: Record<string, unknown> = {}
): Promise<NodeState> {
  if (isNodeState(input)) {
    return {
      images: { ...input.images },
      data: { ...input.data, ...data },
    };
  }
  const base = input instanceof ImageBuffer ? input : await loadImage(input);
  return {
    images: { [DEFAULT_IMAGE_KEY]: base },
    data: { ...data },
  };
}

function isNodeState(input: PipelineInput): input is NodeState {
  const candidate = input as NodeState;
  return (
    candidate &&
    typeof candidate === 'object' &&
    typeof candidate.images === 'object' &&
    typeof candidate.data === 'object'
  );
}
