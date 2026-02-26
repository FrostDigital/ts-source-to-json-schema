/**
 * Tests for handling duplicate type declarations across files
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { toJsonSchemaFromFile, toJsonSchemasFromFile } from "../../src/index.js";

describe("Duplicate Declarations", () => {
  let testDir: string;
  let file1: string;
  let file2: string;
  let entryFile: string;

  beforeEach(() => {
    // Create temp directory for test files
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "ts-json-schema-test-"));

    // File 1: Define ImageDimensions (optional format/fileSize)
    file1 = path.join(testDir, "file1.ts");
    fs.writeFileSync(
      file1,
      `export interface ImageDimensions {
  width: number;
  height: number;
  format?: string;
}`
    );

    // File 2: Define ImageDimensions (required format/fileSize) - DIFFERENT structure
    file2 = path.join(testDir, "file2.ts");
    fs.writeFileSync(
      file2,
      `export interface ImageDimensions {
  width: number;
  height: number;
  format: string;
}`
    );

    // Entry file imports both
    entryFile = path.join(testDir, "entry.ts");
    fs.writeFileSync(
      entryFile,
      `import { ImageDimensions as Dims1 } from "./file1";
import { ImageDimensions as Dims2 } from "./file2";

export interface UsesBoth {
  dim1: Dims1;
  dim2: Dims2;
}`
    );
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Default behavior (error)", () => {
    it("should throw error on duplicate declarations by default", () => {
      expect(() => {
        toJsonSchemaFromFile(entryFile, { followImports: "local" });
      }).toThrow(/Duplicate declaration "ImageDimensions"/);
    });

    it("should throw error when explicitly set to 'error'", () => {
      expect(() => {
        toJsonSchemaFromFile(entryFile, {
          followImports: "local",
          onDuplicateDeclarations: "error",
        });
      }).toThrow(/Duplicate declaration "ImageDimensions"/);
    });

    it("should throw error in batch mode by default", () => {
      expect(() => {
        toJsonSchemasFromFile(entryFile, { followImports: "local" });
      }).toThrow(/Duplicate declaration "ImageDimensions"/);
    });
  });

  describe("Warn mode", () => {
    let originalWarn: typeof console.warn;
    let warnCalls: string[] = [];

    beforeEach(() => {
      warnCalls = [];
      originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnCalls.push(args.join(" "));
      };
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    it("should use first declaration and log warning", () => {
      const schema = toJsonSchemaFromFile(entryFile, {
        followImports: "local",
        onDuplicateDeclarations: "warn",
        rootType: "UsesBoth",
        strictObjects: true,
      });

      // Should succeed (not throw)
      expect(schema).toBeDefined();

      // Should have logged warning
      expect(warnCalls.length).toBeGreaterThan(0);
      expect(warnCalls[0]).toContain('Duplicate declaration "ImageDimensions"');
      expect(warnCalls[0]).toContain("Using first declaration");

      // Should use first declaration (with optional format)
      expect(schema.$defs?.ImageDimensions).toEqual({
        type: "object",
        properties: {
          width: { type: "number" },
          height: { type: "number" },
          format: { type: "string" },
        },
        required: ["width", "height"],
        additionalProperties: false,
      });
    });

    it("should work in batch mode with warnings", () => {
      const schemas = toJsonSchemasFromFile(entryFile, {
        followImports: "local",
        onDuplicateDeclarations: "warn",
      });

      expect(schemas).toBeDefined();
      expect(warnCalls.length).toBeGreaterThan(0);

      // Should have ImageDimensions and UsesBoth
      expect(schemas.ImageDimensions).toBeDefined();
      expect(schemas.UsesBoth).toBeDefined();
    });
  });

  describe("Silent mode", () => {
    let originalWarn: typeof console.warn;
    let warnCalls: string[] = [];

    beforeEach(() => {
      warnCalls = [];
      originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        warnCalls.push(args.join(" "));
      };
    });

    afterEach(() => {
      console.warn = originalWarn;
    });

    it("should use first declaration without warnings", () => {
      const schema = toJsonSchemaFromFile(entryFile, {
        followImports: "local",
        onDuplicateDeclarations: "silent",
        rootType: "UsesBoth",
        strictObjects: true,
      });

      // Should succeed (not throw)
      expect(schema).toBeDefined();

      // Should NOT log warning
      expect(warnCalls.length).toBe(0);

      // Should use first declaration (with optional format)
      expect(schema.$defs?.ImageDimensions).toEqual({
        type: "object",
        properties: {
          width: { type: "number" },
          height: { type: "number" },
          format: { type: "string" },
        },
        required: ["width", "height"],
        additionalProperties: false,
      });
    });

    it("should work in batch mode silently", () => {
      const schemas = toJsonSchemasFromFile(entryFile, {
        followImports: "local",
        onDuplicateDeclarations: "silent",
      });

      expect(schemas).toBeDefined();
      expect(warnCalls.length).toBe(0);

      // Should have ImageDimensions and UsesBoth
      expect(schemas.ImageDimensions).toBeDefined();
      expect(schemas.UsesBoth).toBeDefined();
    });
  });

  describe("Identical declarations", () => {
    beforeEach(() => {
      // Create two identical declarations
      file1 = path.join(testDir, "file1-identical.ts");
      fs.writeFileSync(
        file1,
        `export interface Point {
  x: number;
  y: number;
}`
      );

      file2 = path.join(testDir, "file2-identical.ts");
      fs.writeFileSync(
        file2,
        `export interface Point {
  x: number;
  y: number;
}`
      );

      entryFile = path.join(testDir, "entry-identical.ts");
      fs.writeFileSync(
        entryFile,
        `import { Point as P1 } from "./file1-identical";
import { Point as P2 } from "./file2-identical";

export interface Line {
  start: P1;
  end: P2;
}`
      );
    });

    it("should still throw by default even if identical", () => {
      // Even if structurally identical, it's still a duplicate name
      expect(() => {
        toJsonSchemaFromFile(entryFile, { followImports: "local" });
      }).toThrow(/Duplicate declaration "Point"/);
    });

    it("should work with 'silent' mode for identical declarations", () => {
      const schema = toJsonSchemaFromFile(entryFile, {
        followImports: "local",
        onDuplicateDeclarations: "silent",
        rootType: "Line",
        strictObjects: true,
      });

      expect(schema).toBeDefined();
      expect(schema.$defs?.Point).toEqual({
        type: "object",
        properties: {
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["x", "y"],
        additionalProperties: false,
      });
    });
  });

  describe("No duplicates", () => {
    beforeEach(() => {
      // Create files with different type names
      file1 = path.join(testDir, "file1-nodupe.ts");
      fs.writeFileSync(
        file1,
        `export interface TypeA {
  a: number;
}`
      );

      file2 = path.join(testDir, "file2-nodupe.ts");
      fs.writeFileSync(
        file2,
        `export interface TypeB {
  b: string;
}`
      );

      entryFile = path.join(testDir, "entry-nodupe.ts");
      fs.writeFileSync(
        entryFile,
        `import { TypeA } from "./file1-nodupe";
import { TypeB } from "./file2-nodupe";

export interface Combined {
  a: TypeA;
  b: TypeB;
}`
      );
    });

    it("should work normally when no duplicates exist", () => {
      const schema = toJsonSchemaFromFile(entryFile, {
        followImports: "local",
        rootType: "Combined",
      });

      expect(schema).toBeDefined();
      expect(schema.$defs?.TypeA).toBeDefined();
      expect(schema.$defs?.TypeB).toBeDefined();
    });
  });
});
