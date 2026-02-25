import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('CLI', () => {
  const cliPath = path.join(__dirname, '../dist/cli.js');
  const testFile = path.join(__dirname, '../test-cli-sample.ts');

  function runCli(args: string): string {
    try {
      return execSync(`node ${cliPath} ${args}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error: any) {
      // For error cases, return stderr
      return error.stderr || error.stdout || '';
    }
  }

  it('should show help with --help', () => {
    const output = runCli('--help');
    expect(output).toContain('USAGE:');
    expect(output).toContain('ts-source-to-json-schema');
    expect(output).toContain('OPTIONS:');
  });

  it('should show version with --version', () => {
    const output = runCli('--version');
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should convert a TypeScript file to JSON Schema', () => {
    const output = runCli(testFile);
    const schema = JSON.parse(output);

    expect(schema.$schema).toBeDefined();
    expect(schema.$defs).toBeDefined();
    expect(schema.$defs.User).toBeDefined();
    expect(schema.$defs.ApiResponse).toBeDefined();
  });

  it('should support --rootType option', () => {
    const output = runCli(`${testFile} --rootType User`);
    const schema = JSON.parse(output);

    expect(schema.type).toBe('object');
    expect(schema.properties.id).toBeDefined();
    expect(schema.properties.name).toBeDefined();
    expect(schema.$defs.ApiResponse).toBeDefined();
  });

  it('should support -r short flag', () => {
    const output = runCli(`${testFile} -r ApiResponse`);
    const schema = JSON.parse(output);

    expect(schema.type).toBe('object');
    expect(schema.properties.success).toBeDefined();
    expect(schema.properties.data).toBeDefined();
    expect(schema.$defs.User).toBeDefined();
  });

  it('should support --strictObjects option', () => {
    const output = runCli(`${testFile} -r User --strictObjects`);
    const schema = JSON.parse(output);

    expect(schema.additionalProperties).toBe(false);
    expect(schema.$defs.ApiResponse.additionalProperties).toBe(false);
  });

  it('should support --includeJSDoc false option', () => {
    const output = runCli(`${testFile} -r User --includeJSDoc false`);
    const schema = JSON.parse(output);

    // Without JSDoc, no descriptions or format constraints
    expect(schema.properties.id.description).toBeUndefined();
    expect(schema.properties.email.format).toBeUndefined();
    expect(schema.properties.age.minimum).toBeUndefined();
  });

  it('should handle array syntax in output', () => {
    const output = runCli(`${testFile} -r User`);
    const schema = JSON.parse(output);

    // Both array syntaxes should be handled
    expect(schema.properties.tags).toEqual({
      type: 'array',
      items: { type: 'string' },
      description: "User's tags",
    });

    expect(schema.properties.roles).toEqual({
      type: 'array',
      items: { type: 'string' },
      description: "User's roles",
    });
  });

  it('should show error for non-existent file', () => {
    try {
      execSync(`node ${cliPath} nonexistent.ts`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr).toContain('File not found');
    }
  });

  it('should show error for unknown option', () => {
    try {
      execSync(`node ${cliPath} ${testFile} --unknownFlag`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr).toContain('Unknown option');
    }
  });

  it('should output diagnostics with --doctor', () => {
    const output = runCli(`${testFile} --doctor`);
    const diagnostics = JSON.parse(output);

    expect(diagnostics.timestamp).toBeDefined();
    expect(diagnostics.environment).toBeDefined();
    expect(diagnostics.environment.nodeVersion).toBeDefined();
    expect(diagnostics.environment.platform).toBeDefined();
    expect(diagnostics.input).toBeDefined();
    expect(diagnostics.input.filePath).toBeDefined();
    expect(diagnostics.input.absolutePath).toBeDefined();
    expect(diagnostics.input.fileExists).toBe(true);
    expect(diagnostics.input.source).toBeDefined();
    expect(diagnostics.options).toBeDefined();
    expect(diagnostics.conversionResult).toBeDefined();
    expect(diagnostics.conversionResult.success).toBe(true);
    expect(diagnostics.conversionResult.schema).toBeDefined();
  });

  it('should output diagnostics for non-existent file with --doctor', () => {
    const output = runCli('nonexistent.ts --doctor');
    const diagnostics = JSON.parse(output);

    expect(diagnostics.input.fileExists).toBe(false);
    expect(diagnostics.readError).toBeDefined();
    expect(diagnostics.readError.message).toContain('ENOENT');
    expect(diagnostics.readError.stack).toBeDefined();
  });

  it('should include options in doctor output', () => {
    const output = runCli(`${testFile} --doctor -r User --strictObjects`);
    const diagnostics = JSON.parse(output);

    expect(diagnostics.options.rootType).toBe('User');
    expect(diagnostics.options.strictObjects).toBe(true);
  });
});
