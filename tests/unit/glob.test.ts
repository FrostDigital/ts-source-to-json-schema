/**
 * Unit tests for expandGlob utility
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { expandGlob } from "../../src/path-utils.js";

describe("expandGlob", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "glob-test-"));

    // Create directory structure:
    // tempDir/
    //   a.ts
    //   b.ts
    //   c.json
    //   sub/
    //     d.ts
    //     e.ts
    //     deep/
    //       f.ts
    fs.writeFileSync(path.join(tempDir, "a.ts"), "export interface A {}");
    fs.writeFileSync(path.join(tempDir, "b.ts"), "export interface B {}");
    fs.writeFileSync(path.join(tempDir, "c.json"), "{}");
    fs.mkdirSync(path.join(tempDir, "sub"));
    fs.writeFileSync(path.join(tempDir, "sub", "d.ts"), "export interface D {}");
    fs.writeFileSync(path.join(tempDir, "sub", "e.ts"), "export interface E {}");
    fs.mkdirSync(path.join(tempDir, "sub", "deep"));
    fs.writeFileSync(path.join(tempDir, "sub", "deep", "f.ts"), "export interface F {}");
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return literal path if no wildcards", () => {
    const filePath = path.join(tempDir, "a.ts");
    const result = expandGlob(filePath);
    expect(result).toEqual([filePath]);
  });

  it("should return empty array for non-existent literal path", () => {
    const result = expandGlob(path.join(tempDir, "nonexistent.ts"));
    expect(result).toEqual([]);
  });

  it("should match *.ts in a directory", () => {
    const result = expandGlob(path.join(tempDir, "*.ts"));
    expect(result).toEqual([
      path.join(tempDir, "a.ts"),
      path.join(tempDir, "b.ts"),
    ]);
  });

  it("should not match .json files with *.ts pattern", () => {
    const result = expandGlob(path.join(tempDir, "*.ts"));
    expect(result).not.toContainEqual(path.join(tempDir, "c.json"));
  });

  it("should match **/*.ts recursively", () => {
    const result = expandGlob(path.join(tempDir, "**/*.ts"));
    expect(result).toEqual([
      path.join(tempDir, "a.ts"),
      path.join(tempDir, "b.ts"),
      path.join(tempDir, "sub", "d.ts"),
      path.join(tempDir, "sub", "deep", "f.ts"),
      path.join(tempDir, "sub", "e.ts"),
    ]);
  });

  it("should match sub/*.ts (one level)", () => {
    const result = expandGlob(path.join(tempDir, "sub", "*.ts"));
    expect(result).toEqual([
      path.join(tempDir, "sub", "d.ts"),
      path.join(tempDir, "sub", "e.ts"),
    ]);
  });

  it("should return empty array when no matches", () => {
    const result = expandGlob(path.join(tempDir, "*.xyz"));
    expect(result).toEqual([]);
  });

  it("should support ? wildcard", () => {
    const result = expandGlob(path.join(tempDir, "?.ts"));
    expect(result).toEqual([
      path.join(tempDir, "a.ts"),
      path.join(tempDir, "b.ts"),
    ]);
  });

  it("should match ** at end (all files recursively)", () => {
    const result = expandGlob(path.join(tempDir, "sub", "**"));
    expect(result).toContainEqual(path.join(tempDir, "sub", "d.ts"));
    expect(result).toContainEqual(path.join(tempDir, "sub", "e.ts"));
    expect(result).toContainEqual(path.join(tempDir, "sub", "deep", "f.ts"));
  });
});
