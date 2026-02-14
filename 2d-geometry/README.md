# @dilemmagx/2d-geometry

Lightweight TypeScript-first 2D geometry primitives.

## Features

- Immutable points, vectors, and shapes
- Simple geometric operations
- Node and browser friendly builds

## Install

```bash
npm i @dilemmagx/2d-geometry
```

## Usage

```ts
import { Point, Vector, Line } from '@dilemmagx/2d-geometry';

const a = new Point(0, 0);
const b = new Point(10, 0);
const v = new Vector(3, 4);
const line = new Line(a, b);
console.log(v.mag(), line.length());
```

## License

GPL-3.0
