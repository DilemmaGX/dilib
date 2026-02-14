# @dilemmagx/orchestra

Orchestra is a programmable, node-based image synthesis and processing toolkit.
It focuses on deterministic, pixel-accurate workflows with simple composable nodes.

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

## Resize & Palette Mapping

```ts
import {
  Pipeline,
  createResizeNode,
  createPaletteMapNode,
  saveImage,
  sourceFromUrl,
} from '@dilemmagx/orchestra';

const palette = ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'];
const pipeline = new Pipeline().add(createResizeNode(128, 85)).add(createPaletteMapNode(palette));

const image = await pipeline.run(sourceFromUrl('https://example.com/image.jpg'));
await saveImage(image, './gameboy.png');
```

## Color Mask Mapping

```ts
import {
  Pipeline,
  createMaskMapNode,
  createGaussianBlurNode,
  createMapNode,
  sourceFromUrl,
} from '@dilemmagx/orchestra';

const mask = createMapNode('mask', (_pixel, x, y) => {
  const dx = x - 128;
  const dy = y - 128;
  const inside = dx * dx + dy * dy <= 96 * 96;
  return inside ? '#ffffff' : '#000000';
});

const mapped = createMaskMapNode(mask, [
  { color: '#ffffff', source: createGaussianBlurNode(9, 2) },
]);

const pipeline = new Pipeline().add(mapped);
const image = await pipeline.run(sourceFromUrl('https://example.com/image.jpg'));
```

Mask mapping uses color keys to stitch multiple image results. Each entry maps a mask
color to a source image or node output, with optional tolerance.

You can also use a dedicated crop node:

```ts
import { createSelectionCropNode } from '@dilemmagx/orchestra';

const crop = createSelectionCropNode(selector, { outsideColor: '#00000000' });
```

## Color Formats

```ts
import { toRgba, hsvaToRgba } from '@dilemmagx/orchestra';

const rgba = toRgba('#ffcc00');
const other = hsvaToRgba({ h: 120, s: 50, v: 90, a: 1 });
```

## Common Nodes

```ts
import { Pipeline, createGrayscaleNode, createGammaNode } from '@dilemmagx/orchestra';

const pipeline = new Pipeline().add(createGrayscaleNode()).add(createGammaNode(1.2));
```

Built-in nodes:

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
- createPaletteMapNode
- createRandomFillNode
- createRectNode
- createResizeNode
- createSaltPepperNoiseNode
- createSharpenNode
- createThresholdNode

Selectors and masking:

- createAlphaSelector
- createCircleSelector
- createLumaSelector
- createMaskMapNode
- createMaskedNode
- createRectSelector
- createSelectionCropNode

## Custom Node

```ts
import { Pipeline, createParamNode, sourceFromEmpty } from '@dilemmagx/orchestra';

const posterize = createParamNode('posterize', { step: 32 }, (_context, image, params) =>
  image.mapPixels((pixel) => {
    const next = Math.round(pixel.r / params.step) * params.step;
    return { r: next, g: next, b: next, a: pixel.a };
  })
);

const pipeline = new Pipeline().add(posterize);
const image = await pipeline.run(sourceFromEmpty(512, 512, 'rgba8'));
```
