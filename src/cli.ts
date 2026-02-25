#!/usr/bin/env node

/**
 * CLI entry point for ts-source-to-json-schema
 *
 * Usage:
 *   ts-source-to-json-schema <file.ts> [options]
 *   npx ts-source-to-json-schema src/types.ts --rootType User
 *
 * Reads a TypeScript file and outputs JSON Schema to stdout.
 */

import * as fs from 'fs';
import * as path from 'path';
import { toJsonSchema, toJsonSchemaFromFile, EmitterOptions } from './index.js';

interface CliOptions extends EmitterOptions {
  help?: boolean;
  version?: boolean;
  doctor?: boolean;
  followImports?: "none" | "local" | "all";
  baseDir?: string;
}

const version = '0.1.0'; // TODO: Read from package.json

function showHelp(): void {
  console.log(`
ts-source-to-json-schema v${version}

USAGE:
  ts-source-to-json-schema <file.ts> [options]

DESCRIPTION:
  Convert TypeScript type definitions to JSON Schema (2020-12 draft).

OPTIONS:
  -h, --help                     Show this help message
  -v, --version                  Show version number
      --doctor                   Output diagnostic information for debugging

  -r, --rootType <name>          Emit this type as root (others in $defs)
  -s, --includeSchema <bool>     Include $schema property (default: true)
      --schemaVersion <url>      Custom $schema URL
      --strictObjects            Set additionalProperties: false globally
      --additionalProperties     Set additionalProperties default (true/false)
      --includeJSDoc <bool>      Include JSDoc comments (default: true)

  --followImports <mode>         Follow imports: none, local, all (default: local)
  --baseDir <path>               Base directory for resolving imports

EXAMPLES:
  # Convert all types in a file
  ts-source-to-json-schema src/types.ts

  # Convert a specific root type
  ts-source-to-json-schema src/api.ts --rootType ApiResponse

  # Follow local imports (default)
  ts-source-to-json-schema src/api.ts --followImports local

  # Single file, no imports
  ts-source-to-json-schema src/types.ts --followImports none

  # Strict object mode (no additional properties)
  ts-source-to-json-schema src/config.ts --strictObjects

  # Disable JSDoc processing
  ts-source-to-json-schema src/types.ts --includeJSDoc false

  # Combine options
  ts-source-to-json-schema src/user.ts -r User --strictObjects --followImports local
`);
}

function parseArgs(args: string[]): { filePath: string | null; options: CliOptions } {
  const options: CliOptions = {};
  let filePath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
    } else if (arg === '--doctor') {
      options.doctor = true;
    } else if (arg === '-r' || arg === '--rootType') {
      options.rootType = args[++i];
    } else if (arg === '-s' || arg === '--includeSchema') {
      options.includeSchema = parseBoolean(args[++i]);
    } else if (arg === '--schemaVersion') {
      options.schemaVersion = args[++i];
    } else if (arg === '--strictObjects') {
      options.strictObjects = true;
    } else if (arg === '--additionalProperties') {
      options.additionalProperties = parseBoolean(args[++i]);
    } else if (arg === '--includeJSDoc') {
      options.includeJSDoc = parseBoolean(args[++i]);
    } else if (arg === '--followImports') {
      const mode = args[++i];
      if (!['none', 'local', 'all'].includes(mode)) {
        console.error(`Invalid followImports mode: ${mode}`);
        console.error('Valid options: none, local, all');
        process.exit(1);
      }
      options.followImports = mode as "none" | "local" | "all";
    } else if (arg === '--baseDir') {
      options.baseDir = args[++i];
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      console.error('Run with --help to see available options');
      process.exit(1);
    } else {
      // First non-flag argument is the file path
      if (!filePath) {
        filePath = arg;
      } else {
        console.error(`Unexpected argument: ${arg}`);
        process.exit(1);
      }
    }
  }

  return { filePath, options };
}

function parseBoolean(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true;
  }
  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false;
  }
  console.error(`Invalid boolean value: ${value}`);
  console.error('Use: true/false, yes/no, or 1/0');
  process.exit(1);
}

function main(): void {
  const args = process.argv.slice(2);

  // Handle no arguments
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const { filePath, options } = parseArgs(args);

  // Handle special flags
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    console.log(version);
    process.exit(0);
  }

  // Validate file path
  if (!filePath) {
    console.error('Error: No input file specified');
    console.error('Usage: ts-source-to-json-schema <file.ts> [options]');
    console.error('Run with --help for more information');
    process.exit(1);
  }

  // Resolve file path
  const absolutePath = path.resolve(process.cwd(), filePath);

  // Check if file exists (skip in doctor mode to provide diagnostics)
  if (!fs.existsSync(absolutePath) && !options.doctor) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Read TypeScript source
  let source: string;
  let readError: Error | null = null;
  try {
    source = fs.readFileSync(absolutePath, 'utf-8');
  } catch (error) {
    readError = error instanceof Error ? error : new Error(String(error));
    if (!options.doctor) {
      console.error(`Error reading file: ${readError.message}`);
      process.exit(1);
    }
    source = ''; // For doctor mode
  }

  // Doctor mode: output comprehensive diagnostics
  if (options.doctor) {
    const { help, version, doctor, ...emitterOptions } = options;

    const inputInfo: Record<string, unknown> = {
      filePath: filePath,
      absolutePath: absolutePath,
      fileExists: fs.existsSync(absolutePath),
    };

    // Add file stats if file exists
    if (fs.existsSync(absolutePath)) {
      try {
        const stats = fs.statSync(absolutePath);
        inputInfo.fileSize = stats.size;
        inputInfo.modified = stats.mtime.toISOString();
      } catch (error) {
        // Ignore stat errors
      }
    }

    const diagnostics: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      version: version,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
      },
      input: inputInfo,
      options: emitterOptions,
    };

    // Add read error if present
    if (readError) {
      diagnostics.readError = {
        message: readError.message,
        stack: readError.stack,
      };
    } else {
      // Add source content and length
      inputInfo.sourceLength = source.length;
      inputInfo.sourceLines = source.split('\n').length;
      inputInfo.source = source;

      // Try to convert and capture result or error
      try {
        const schema = toJsonSchema(source, emitterOptions);
        diagnostics.conversionResult = {
          success: true,
          schema: schema,
        };
      } catch (error) {
        const conversionError = error instanceof Error ? error : new Error(String(error));
        diagnostics.conversionResult = {
          success: false,
          error: {
            message: conversionError.message,
            stack: conversionError.stack,
          },
        };
      }
    }

    console.log(JSON.stringify(diagnostics, null, 2));
    process.exit(0);
  }

  // Convert to JSON Schema
  let schema: unknown;
  try {
    // Remove help, version, doctor from emitter options
    const { help, version, doctor, ...emitterOptions } = options;

    // Determine followImports mode (default to 'local' in CLI)
    const followMode = emitterOptions.followImports ?? 'local';

    if (followMode !== 'none') {
      // Use file-based API with import resolution
      const baseDir = emitterOptions.baseDir ?? path.dirname(absolutePath);
      schema = toJsonSchemaFromFile(absolutePath, {
        ...emitterOptions,
        baseDir,
        followImports: followMode,
      });
    } else {
      // Use string-based API (single file, no imports)
      schema = toJsonSchema(source, emitterOptions);
    }
  } catch (error) {
    console.error(`Error converting to JSON Schema: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Output JSON Schema to stdout
  console.log(JSON.stringify(schema, null, 2));
}

main();
