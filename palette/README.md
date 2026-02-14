# @dilemmagx/palette

Palette is a CLI + TypeScript toolkit that reads a single input (HEX, data URI, URL, or local path), detects its type automatically, and generates palettes.

## Install

```bash
npm i @dilemmagx/palette
```

## CLI

```bash
palette <input>
```

Examples:

```bash
palette ff7a18
palette ./image.png
palette https://example.com/image.jpg
```

The CLI prints every algorithm by default. Each algorithm output is a single line of color blocks with readable text inside each block for easy selection and copying.
Palette sizes vary by algorithm, unless overridden.

Options:

- `-a, --algorithm <name>`: Print a single algorithm
- `-c, --count <number>`: Override palette size

Output:

- One header line per algorithm
- Three connected rows of color blocks with readable HEX labels

## Input Types

- HEX: `RRGGBB` or `RGB` in CLI (no leading `#`). In TypeScript, `#RRGGBB` and `#RGB` are accepted.
- Data URI: `data:image/...;base64,...`
- URL: `http://` or `https://`
- Path: local image path (default fallback)

## Algorithms

- analogous
- complementary
- triadic
- tetradic
- split-complementary
- monochrome
- monet

Monet uses image quantization and color scoring inspired by Material Color Utilities.

## TypeScript API

```ts
import {
  generatePalette,
  generatePaletteFromHex,
  generatePaletteFromDataUri,
  generatePaletteFromUrl,
  generatePaletteFromPath,
  listAlgorithms,
} from '@dilemmagx/palette';

const result = await generatePalette('#ff7a18', { algorithm: 'analogous' });
console.log(result.colors);
```

`generatePalette` detects the input type automatically. The other functions target a specific input type. Use `count` to override palette size.

## License

GPL-3.0
