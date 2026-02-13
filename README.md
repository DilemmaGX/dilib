# dilib

**dilib** is a collection of personal tools, libraries, and utilities created by [DilemmaGX](https://github.com/DilemmaGX).

This repository serves as a monorepo for various projects I develop and use.

## Development

This repository is set up as a monorepo with centralized development tools.

### Prerequisites

- Node.js (Latest LTS recommended)
- npm

### Setup

```bash
npm install
```

### Commands

- **Format Code**: `npm run format` (Prettier)
- **Lint Code**: `npm run lint` (ESLint)

## Projects

### [minidoc](./minidoc)

A lightweight, powerful Markdown documentation generator with advanced code block features.

- **Features**: Table-based code layout, sticky line numbers, file inclusion (`{{ }}` syntax), GFM alerts, and collapsible sections.
- **License**: GPL-3.0

### [2d-geometry](./2d-geometry)

A professional, immutable 2D geometry library for TypeScript/JavaScript.

- **Features**: Points, Vectors, Lines, Circles, Polygons, Rectangles, and Affine Transformations.
- **License**: GPL-3.0

## License

Individual projects within this repository may have their own licenses. Please refer to the `LICENSE` file or `package.json` in each project directory for specific terms.
