export type { InputType, PaletteAlgorithm, PaletteOptions, PaletteResult } from './core';
export {
  detectInputType,
  generatePalette,
  generatePaletteFromHex,
  generatePaletteFromDataUri,
  generatePaletteFromUrl,
  generatePaletteFromPath,
  listAlgorithms,
} from './core';
export { getGameBoyPalette } from './presets';
export type { RgbaColor } from './presets';
