import { ImageBuffer } from './image';
import { ImageSource } from './types';
import { loadImage } from './sources';
import { createRandom, SeededRandom } from './random';
import { ImageNode, NodeContext, createMapNode, createNoiseNode } from './nodes';

/**
 * Options for running a pipeline.
 */
export type PipelineOptions = {
  seed?: number | string;
  random?: SeededRandom;
};

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
  async run(input: ImageSource | ImageBuffer, options: PipelineOptions = {}): Promise<ImageBuffer> {
    const context: NodeContext = {
      random: options.random ?? createRandom(options.seed),
    };
    const base = input instanceof ImageBuffer ? input : await loadImage(input);
    let current = base;
    for (const node of this.nodes) {
      current = await node.run(context, current);
    }
    return current;
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
