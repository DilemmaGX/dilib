/**
 * Common palette presets.
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Returns the classic Game Boy palette.
 * Colors: #9bbc0f, #8bac0f, #306230, #0f380f
 */
export function getGameBoyPalette(): RgbaColor[] {
  return [
    { r: 155, g: 188, b: 15, a: 255 }, // #9bbc0f
    { r: 139, g: 172, b: 15, a: 255 }, // #8bac0f
    { r: 48, g: 98, b: 48, a: 255 },   // #306230
    { r: 15, g: 56, b: 15, a: 255 },   // #0f380f
  ];
}
