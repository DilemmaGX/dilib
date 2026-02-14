import { generatePalette, listAlgorithms, type PaletteAlgorithm } from "./core";

/**
 * Parsed CLI options.
 */
interface CliOptions {
  input?: string;
  algorithm?: PaletteAlgorithm;
  count?: number;
  help?: boolean;
}

const USAGE = `palette <input>

Input types are detected automatically: HEX, data URI, URL, path
CLI HEX input must not start with #

Options:
  -a, --algorithm <name>  Print a single algorithm
  -c, --count <number>    Override palette size
  -h, --help  Show help
`;

/**
 * CLI entry point.
 */
async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.input) {
    process.stdout.write(USAGE);
    process.stdout.write(`Algorithms: ${listAlgorithms().join(", ")}\n`);
    return;
  }

  if (isCliHexWithHash(options.input)) {
    throw new Error("CLI HEX input must not start with #. Use RRGGBB or RGB.");
  }

  const algorithms = options.algorithm ? [options.algorithm] : listAlgorithms();
  for (const algorithm of algorithms) {
    const palette = await generatePalette(options.input, {
      algorithm,
      count: options.count,
    });
    const blocks = palette.colors.map((hex) => cell(hex));
    const header = formatHeader(algorithm);
    const top = blocks.map((block) => block.top).join("");
    const middle = blocks.map((block) => block.middle).join("");
    const bottom = blocks.map((block) => block.bottom).join("");
    process.stdout.write(`${header}\n${top}\n${middle}\n${bottom}\n\n`);
  }
}

/**
 * Parses CLI arguments into options.
 * @param args Raw CLI arguments.
 */
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "-a" || arg === "--algorithm") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("Missing algorithm value.");
      }
      const algorithms = listAlgorithms();
      if (!algorithms.includes(value as PaletteAlgorithm)) {
        throw new Error(`Unknown algorithm: ${value}`);
      }
      options.algorithm = value as PaletteAlgorithm;
      i += 1;
      continue;
    }
    if (arg === "-c" || arg === "--count") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("Missing count value.");
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error("Count must be a positive integer.");
      }
      options.count = parsed;
      i += 1;
      continue;
    }
    if (!options.input) {
      options.input = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

/**
 * Checks whether the input is a HEX string with a leading #.
 * @param value The raw input string.
 */
function isCliHexWithHash(value: string): boolean {
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed);
}

/**
 * Formats the algorithm header line.
 * @param algorithm Algorithm name.
 */
function formatHeader(algorithm: string): string {
  const label = algorithm.replace(/-/g, " ").toUpperCase();
  return `== ${label} ==`;
}

/**
 * Builds a 3-line color block with readable text.
 * @param hex The HEX color string.
 */
function cell(hex: string): { top: string; middle: string; bottom: string } {
  const label = hex.toUpperCase();
  const padded = ` ${label} `;
  const rgb = hexToRgb(hex);
  const fg = pickTextColor(rgb);
  const bg = `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m`;
  const fgCode = `\x1b[38;2;${fg.r};${fg.g};${fg.b}m`;
  const reset = "\x1b[0m";
  const blank = " ".repeat(padded.length);
  return {
    top: `${bg}${blank}${reset}`,
    middle: `${bg}${fgCode}${padded}${reset}`,
    bottom: `${bg}${blank}${reset}`,
  };
}

/**
 * Picks black or white text based on background luminance.
 * @param rgb The background color.
 */
function pickTextColor(rgb: { r: number; g: number; b: number }): {
  r: number;
  g: number;
  b: number;
} {
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.6 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}

/**
 * Converts a HEX string to RGB.
 * @param hex The HEX color string.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
