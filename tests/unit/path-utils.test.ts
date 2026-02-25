/**
 * Tests for path resolution utilities
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { isRelativeImport, resolveImportPath, resolveExtensions } from "../../src/path-utils.js";

describe("isRelativeImport", () => {
  it("should return true for ./ paths", () => {
    expect(isRelativeImport("./pet")).toBe(true);
    expect(isRelativeImport("./types/user")).toBe(true);
  });

  it("should return true for ../ paths", () => {
    expect(isRelativeImport("../pet")).toBe(true);
    expect(isRelativeImport("../../types/user")).toBe(true);
  });

  it("should return false for absolute paths", () => {
    expect(isRelativeImport("/absolute/path")).toBe(false);
    expect(isRelativeImport("C:\\absolute\\path")).toBe(false);
  });

  it("should return false for node_modules imports", () => {
    expect(isRelativeImport("events")).toBe(false);
    expect(isRelativeImport("@types/node")).toBe(false);
  });
});

describe("resolveImportPath", () => {
  it("should return null for 'none' mode", () => {
    const result = resolveImportPath("./pet", "/foo/bar.ts", "none");
    expect(result).toBeNull();
  });

  it("should resolve relative imports in 'local' mode", () => {
    const result = resolveImportPath("./pet", "/foo/bar.ts", "local");
    expect(result).toBe(path.resolve("/foo", "pet"));
  });

  it("should skip node_modules in 'local' mode", () => {
    const result = resolveImportPath("events", "/foo/bar.ts", "local");
    expect(result).toBeNull();
  });

  it("should resolve relative imports in 'all' mode", () => {
    const result = resolveImportPath("./pet", "/foo/bar.ts", "all");
    expect(result).toBe(path.resolve("/foo", "pet"));
  });

  it("should skip node_modules in 'all' mode (MVP)", () => {
    // For MVP, 'all' mode behaves same as 'local'
    const result = resolveImportPath("events", "/foo/bar.ts", "all");
    expect(result).toBeNull();
  });

  it("should resolve ../ paths correctly", () => {
    const result = resolveImportPath("../types/user", "/foo/bar/baz.ts", "local");
    expect(result).toBe(path.resolve("/foo/types/user"));
  });

  it("should resolve from file's directory, not file itself", () => {
    const result = resolveImportPath("./sibling", "/foo/bar/file.ts", "local");
    expect(result).toBe(path.resolve("/foo/bar/sibling"));
  });
});

describe("resolveExtensions", () => {
  let tempDir: string;

  beforeAll(() => {
    // Create temporary directory structure
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "path-utils-test-"));
    fs.writeFileSync(path.join(tempDir, "exact.ts"), "");
    fs.writeFileSync(path.join(tempDir, "with-tsx.tsx"), "");
    fs.writeFileSync(path.join(tempDir, "with-dts.d.ts"), "");
    fs.mkdirSync(path.join(tempDir, "dir-with-index"));
    fs.writeFileSync(path.join(tempDir, "dir-with-index", "index.ts"), "");
    fs.mkdirSync(path.join(tempDir, "dir-with-tsx-index"));
    fs.writeFileSync(path.join(tempDir, "dir-with-tsx-index", "index.tsx"), "");
  });

  afterAll(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should find exact match", () => {
    const result = resolveExtensions(path.join(tempDir, "exact.ts"));
    expect(result).toBe(path.join(tempDir, "exact.ts"));
  });

  it("should add .ts extension", () => {
    const result = resolveExtensions(path.join(tempDir, "exact"));
    expect(result).toBe(path.join(tempDir, "exact.ts"));
  });

  it("should add .tsx extension", () => {
    const result = resolveExtensions(path.join(tempDir, "with-tsx"));
    expect(result).toBe(path.join(tempDir, "with-tsx.tsx"));
  });

  it("should add .d.ts extension", () => {
    const result = resolveExtensions(path.join(tempDir, "with-dts"));
    expect(result).toBe(path.join(tempDir, "with-dts.d.ts"));
  });

  it("should resolve index.ts in directory", () => {
    const result = resolveExtensions(path.join(tempDir, "dir-with-index"));
    expect(result).toBe(path.join(tempDir, "dir-with-index", "index.ts"));
  });

  it("should resolve index.tsx in directory", () => {
    const result = resolveExtensions(path.join(tempDir, "dir-with-tsx-index"));
    expect(result).toBe(path.join(tempDir, "dir-with-tsx-index", "index.tsx"));
  });

  it("should return null for non-existent file", () => {
    const result = resolveExtensions(path.join(tempDir, "does-not-exist"));
    expect(result).toBeNull();
  });

  it("should prefer .ts over index.ts", () => {
    // Create both foo.ts and foo/index.ts
    fs.writeFileSync(path.join(tempDir, "foo.ts"), "");
    fs.mkdirSync(path.join(tempDir, "foo"));
    fs.writeFileSync(path.join(tempDir, "foo", "index.ts"), "");

    const result = resolveExtensions(path.join(tempDir, "foo"));
    expect(result).toBe(path.join(tempDir, "foo.ts"));

    // Clean up
    fs.unlinkSync(path.join(tempDir, "foo.ts"));
    fs.unlinkSync(path.join(tempDir, "foo", "index.ts"));
    fs.rmdirSync(path.join(tempDir, "foo"));
  });
});
