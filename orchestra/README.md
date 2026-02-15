# @dilemmagx/orchestra

Orchestra is a programmable, node-based image synthesis and processing toolkit.
The engine is centered around a flexible node state, so every built-in node is created through
the same custom node API that you use in your own projects.

## Install

```bash
npm i @dilemmagx/orchestra
```

## Quick Start

```ts
import { Pipeline, createNoiseNode, createInvertNode, sourceFromEmpty } from '@dilemmagx/orchestra';

const pipeline = new Pipeline().add(createNoiseNode({ grayscale: true })).add(createInvertNode());
const image = await pipeline.run(sourceFromEmpty(256, 256, 'rgba8'), { seed: 42 });
```

## Core Concepts

- A pipeline runs nodes sequentially.
- Each node receives a shared context and a mutable state object.
- The default image key is "image", but nodes may read and write additional image keys.

## Simplified Node API

```ts
import { node, pipeline, sourceFromEmpty } from '@dilemmagx/orchestra';

const gradient = node({
  name: 'gradient',
  params: { from: '#22d3ee', to: '#0f172a' },
  run: (pixels, { params }) => {
    const height = pixels.length;
    const width = pixels[0]?.length ?? 0;
    return pixels.map((row, y) =>
      row.map((_pixel, x) => {
        const t = x / Math.max(1, width - 1);
        return {
          r: Math.round(34 + (15 - 34) * t),
          g: Math.round(211 + (23 - 211) * t),
          b: Math.round(238 + (42 - 238) * t),
          a: 255,
        };
      })
    );
  },
});

const image = await pipeline(gradient).run(sourceFromEmpty(512, 256, 'rgba8'));
```

Nodes created with `node()` receive a 2D pixel matrix by default. Node names are optional;
if omitted, Orchestra assigns incremental names like `node-1` to improve traceability.

## Noise Suite

```ts
import {
  pipeline,
  sourceFromEmpty,
  createValueNoiseNode,
  createVoronoiNoiseNode,
  createFractalNoiseNode,
} from '@dilemmagx/orchestra';

const image = await pipeline(
  createValueNoiseNode({ scale: 32, octaves: 2, min: 20, max: 220 }),
  createVoronoiNoiseNode({ scale: 28, jitter: 0.8, mode: 'edge' }),
  createFractalNoiseNode({ scale: 40, octaves: 4, persistence: 0.55 })
).run(sourceFromEmpty(512, 512, 'rgba8'), { seed: 42 });
```

```ts
import {
  pipeline,
  sourceFromEmpty,
  createPerlinNoiseNode,
  createTurbulenceNoiseNode,
  createRidgedNoiseNode,
} from '@dilemmagx/orchestra';

const image = await pipeline(
  createPerlinNoiseNode({ scale: 48, octaves: 3 }),
  createTurbulenceNoiseNode({ scale: 36, octaves: 4, persistence: 0.6 }),
  createRidgedNoiseNode({ scale: 40, octaves: 5, persistence: 0.55 })
).run(sourceFromEmpty(512, 512, 'rgba8'), { seed: 'detail' });
```

## Text Tool

```ts
import { createTextNode, pipeline, sourceFromEmpty } from '@dilemmagx/orchestra';

const text = createTextNode({
  text: 'HELLO ORCHESTRA',
  font: {
    family: 'Inter',
    source: { filePath: './fonts/Inter-SemiBold.ttf' },
    weight: 600,
  },
  layout: { x: 64, y: 64, maxWidth: 640, align: 'left' },
  style: { fontSize: 48, bold: true, underline: true },
});

const image = await pipeline(text).run(sourceFromEmpty(800, 450, 'rgba8'));
```

Provide a font file to keep output identical across machines. If a font source is not supplied,
the system font family is used when available.

## Custom Node

```ts
import { Pipeline, createImageNode, sourceFromEmpty } from '@dilemmagx/orchestra';

const posterize = createImageNode(
  'posterize',
  { step: 32 },
  (_context, image, params) =>
    image.mapPixels((pixel) => {
      const next = Math.round(pixel.r / params.step) * params.step;
      return { r: next, g: next, b: next, a: pixel.a };
    })
);

const pipeline = new Pipeline().add(posterize);
const image = await pipeline.run(sourceFromEmpty(512, 512, 'rgba8'));
```

## Advanced Node State

```ts
import {
  Pipeline,
  defineNode,
  getImage,
  sourceFromEmpty,
  DEFAULT_IMAGE_KEY,
} from '@dilemmagx/orchestra';

const stashStats = defineNode({
  name: 'stash-stats',
  run: (_context, state) => {
    const image = getImage(state, DEFAULT_IMAGE_KEY);
    return {
      data: {
        pixelCount: image.width * image.height,
      },
    };
  },
});

const pipeline = new Pipeline().add(stashStats);
const state = await pipeline.runState(sourceFromEmpty(256, 256, 'rgba8'));
console.log(state.data.pixelCount);
```

## Mask Mapping

```ts
import {
  Pipeline,
  createMaskMapNode,
  createGaussianBlurNode,
  createMapNode,
  sourceFromUrl,
  toRgba,
} from '@dilemmagx/orchestra';

const mask = createMapNode('mask', (_pixel, x, y) => {
  const dx = x - 128;
  const dy = y - 128;
  const inside = dx * dx + dy * dy <= 96 * 96;
  return inside ? toRgba('#ffffff') : toRgba('#000000');
});

const mapped = createMaskMapNode(mask, [
  { color: '#ffffff', source: createGaussianBlurNode(9, 2) },
]);

const pipeline = new Pipeline().add(mapped);
const image = await pipeline.run(sourceFromUrl('https://example.com/image.jpg'));
```

## Built-in Nodes

- createBrightnessNode
- createCheckerboardNode
- createCircleNode
- createConvolutionNode
- createContrastNode
- createEdgeDetectNode
- createFillNode
- createGammaNode
- createGaussianBlurNode
- createGaussianNoiseNode
- createGrayscaleNode
- createInvertNode
- createNoiseNode
- createFractalNoiseNode
- createPerlinNoiseNode
- createRidgedNoiseNode
- createTurbulenceNoiseNode
- createValueNoiseNode
- createVoronoiNoiseNode
- createPaletteMapNode
- createRandomFillNode
- createRectNode
- createResizeNode
- createSaltPepperNoiseNode
- createSharpenNode
- createThresholdNode
- createTextNode

Selectors and masking helpers:

- createAlphaSelector
- createCircleSelector
- createLumaSelector
- createMaskMapNode
- createMaskedNode
- createRectSelector
- createSelectionCropNode

## License

GPL-3.0
