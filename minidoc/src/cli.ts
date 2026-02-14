import { program } from 'commander';
import { processContent } from './core';
import fs from 'fs';
import path from 'path';

/**
 * CLI entry point for Minidoc.
 * Handles command-line arguments and invokes the documentation processor.
 */

program.name('minidoc').description('A minimal documentation generator CLI').version('1.0.0');

program
  .command('build')
  .description('Build documentation from a markdown file')
  .argument('<file>', 'The markdown file to process')
  .option('-o, --output <path>', 'Output file path')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-t, --title <title>', 'Document title')
  .option('--no-copy', 'Disable copy button for code blocks')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(process.cwd(), file);

      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
      }

      if (options.verbose) {
        console.log(`Reading file: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      const result = await processContent(content, {
        title: options.title,
        verbose: options.verbose,
        showCopyButton: options.copy,
      });

      if (options.output) {
        const outputPath = path.resolve(process.cwd(), options.output);
        fs.writeFileSync(outputPath, result.output);
        console.log(`Documentation generated at: ${outputPath}`);
      } else {
        const parsedPath = path.parse(filePath);
        const outputPath = path.join(parsedPath.dir, `${parsedPath.name}.html`);
        fs.writeFileSync(outputPath, result.output);
        console.log(`Documentation generated at: ${outputPath}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('An error occurred:', message);
      process.exit(1);
    }
  });

program.parse();
