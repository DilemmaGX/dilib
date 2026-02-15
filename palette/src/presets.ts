/**
 * RGBA color in 0-255 integer space.
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
    { r: 155, g: 188, b: 15, a: 255 },
    { r: 139, g: 172, b: 15, a: 255 },
    { r: 48, g: 98, b: 48, a: 255 },
    { r: 15, g: 56, b: 15, a: 255 },
  ];
}
