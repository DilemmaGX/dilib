export type {
  BuiltInPaletteAlgorithm,
  InputType,
  PaletteAlgorithm,
  PaletteGenerator,
  PaletteGeneratorInput,
  PaletteOptions,
  PaletteResult,
} from './core';
export {
  detectInputType,
  generatePalette,
  generatePaletteFromHex,
  generatePaletteFromDataUri,
  generatePaletteFromUrl,
  generatePaletteFromPath,
  getAlgorithm,
  listAlgorithms,
  registerAlgorithm,
  unregisterAlgorithm,
} from './core';
export { getGameBoyPalette } from './presets';
export type { RgbaColor } from './presets';
