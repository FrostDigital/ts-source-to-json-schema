/**
 * Integration tests for toJsonSchemasFromFiles - multi-entry batch schema generation
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { toJsonSchemasFromFiles } from "../../src/index.js";

describe("toJsonSchemasFromFiles", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "multi-entry-test-"));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should generate schemas from array of two files", () => {
    const userPath = path.join(tempDir, "User.ts");
    fs.writeFileSync(userPath, `
      export interface User {
        id: string;
        name: string;
      }
    `);

    const postPath = path.join(tempDir, "Post.ts");
    fs.writeFileSync(postPath, `
      export interface Post {
        id: string;
        title: string;
      }
    `);

    const schemas = toJsonSchemasFromFiles([userPath, postPath]);

    expect(schemas.User).toBeDefined();
    expect(schemas.User.properties).toHaveProperty("id");
    expect(schemas.User.properties).toHaveProperty("name");

    expect(schemas.Post).toBeDefined();
    expect(schemas.Post.properties).toHaveProperty("id");
    expect(schemas.Post.properties).toHaveProperty("title");
  });

  it("should generate schemas from glob pattern", () => {
    // Create a subdirectory for glob test
    const globDir = path.join(tempDir, "glob-test");
    fs.mkdirSync(globDir, { recursive: true });

    fs.writeFileSync(path.join(globDir, "Alpha.ts"), `
      export interface Alpha { a: string; }
    `);
    fs.writeFileSync(path.join(globDir, "Beta.ts"), `
      export interface Beta { b: number; }
    `);

    const schemas = toJsonSchemasFromFiles(path.join(globDir, "*.ts"));

    expect(schemas.Alpha).toBeDefined();
    expect(schemas.Beta).toBeDefined();
  });

  it("should return empty object for empty array", () => {
    const schemas = toJsonSchemasFromFiles([]);
    expect(schemas).toEqual({});
  });

  it("should return empty object for glob with no matches", () => {
    const schemas = toJsonSchemasFromFiles(path.join(tempDir, "*.xyz"));
    expect(schemas).toEqual({});
  });

  it("should deduplicate shared imports with followImports: 'local'", () => {
    const sharedDir = path.join(tempDir, "shared-test");
    fs.mkdirSync(sharedDir, { recursive: true });

    // Shared type
    fs.writeFileSync(path.join(sharedDir, "Shared.ts"), `
      export default interface Shared {
        id: string;
        createdAt: string;
      }
    `);

    // Two files importing the same shared type
    fs.writeFileSync(path.join(sharedDir, "ReqA.ts"), `
      import Shared from "./Shared";
      export interface ReqA extends Shared {
        fieldA: string;
      }
    `);

    fs.writeFileSync(path.join(sharedDir, "ReqB.ts"), `
      import Shared from "./Shared";
      export interface ReqB extends Shared {
        fieldB: number;
      }
    `);

    const schemas = toJsonSchemasFromFiles(
      [path.join(sharedDir, "ReqA.ts"), path.join(sharedDir, "ReqB.ts")],
      { followImports: "local" }
    );

    // Both schemas should exist
    expect(schemas.ReqA).toBeDefined();
    expect(schemas.ReqB).toBeDefined();

    // Shared should be in definitions of both
    expect(schemas.ReqA.definitions).toHaveProperty("Shared");
    expect(schemas.ReqB.definitions).toHaveProperty("Shared");
  });

  it("should work with followImports: 'none' (each file parsed independently)", () => {
    const noneDir = path.join(tempDir, "none-test");
    fs.mkdirSync(noneDir, { recursive: true });

    fs.writeFileSync(path.join(noneDir, "TypeA.ts"), `
      export interface TypeA { a: string; }
    `);
    fs.writeFileSync(path.join(noneDir, "TypeB.ts"), `
      export interface TypeB { b: number; }
    `);

    const schemas = toJsonSchemasFromFiles(
      [path.join(noneDir, "TypeA.ts"), path.join(noneDir, "TypeB.ts")],
      { followImports: "none" }
    );

    expect(schemas.TypeA).toBeDefined();
    expect(schemas.TypeB).toBeDefined();
  });

  it("should respect strictObjects option", () => {
    const strictDir = path.join(tempDir, "strict-test");
    fs.mkdirSync(strictDir, { recursive: true });

    fs.writeFileSync(path.join(strictDir, "Strict.ts"), `
      export interface Strict { x: string; }
    `);

    const schemas = toJsonSchemasFromFiles(
      [path.join(strictDir, "Strict.ts")],
      { strictObjects: true }
    );

    expect(schemas.Strict).toBeDefined();
    expect(schemas.Strict.additionalProperties).toBe(false);
  });

  it("should handle Flink use case - multiple schema files with shared imports", () => {
    const flinkDir = path.join(tempDir, "flink-test");
    const schemasDir = path.join(flinkDir, "schemas");
    fs.mkdirSync(schemasDir, { recursive: true });

    // Shared User type
    fs.writeFileSync(path.join(schemasDir, "User.ts"), `
      export default interface User {
        _id: string;
        name: string;
        email: string;
      }
    `);

    // PostUserReq.ts
    fs.writeFileSync(path.join(flinkDir, "PostUserReq.ts"), `
      import User from "./schemas/User";
      export interface PostUserReq {
        name: string;
        email: string;
      }
    `);

    // GetUserRes.ts
    fs.writeFileSync(path.join(flinkDir, "GetUserRes.ts"), `
      import User from "./schemas/User";
      export interface GetUserRes extends User {}
    `);

    const schemas = toJsonSchemasFromFiles(
      [path.join(flinkDir, "PostUserReq.ts"), path.join(flinkDir, "GetUserRes.ts")],
      { followImports: "local" }
    );

    expect(schemas.PostUserReq).toBeDefined();
    expect(schemas.GetUserRes).toBeDefined();

    // GetUserRes should reference User in definitions
    expect(schemas.GetUserRes.definitions).toHaveProperty("User");
  });

  it("should work with defineNameTransform", () => {
    const transformDir = path.join(tempDir, "transform-test");
    fs.mkdirSync(transformDir, { recursive: true });

    fs.writeFileSync(path.join(transformDir, "Foo.ts"), `
      export interface Foo { x: string; }
    `);
    fs.writeFileSync(path.join(transformDir, "Bar.ts"), `
      export interface Bar { y: number; }
    `);

    const schemas = toJsonSchemasFromFiles(
      [path.join(transformDir, "Foo.ts"), path.join(transformDir, "Bar.ts")],
      {
        defineNameTransform: (name, _decl, ctx) => {
          const file = path.basename(ctx?.relativePath ?? "", ".ts");
          return file ? `${file}.${name}` : name;
        },
      }
    );

    // The keys should be transformed
    const keys = Object.keys(schemas);
    expect(keys.some(k => k.includes("Foo"))).toBe(true);
    expect(keys.some(k => k.includes("Bar"))).toBe(true);
  });

  it("should include $schema field by default", () => {
    const schemaDir = path.join(tempDir, "schema-field-test");
    fs.mkdirSync(schemaDir, { recursive: true });

    fs.writeFileSync(path.join(schemaDir, "Thing.ts"), `
      export interface Thing { name: string; }
    `);

    const schemas = toJsonSchemasFromFiles([path.join(schemaDir, "Thing.ts")]);

    expect(schemas.Thing.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("should disable $schema with includeSchema: false", () => {
    const schemaDir2 = path.join(tempDir, "no-schema-test");
    fs.mkdirSync(schemaDir2, { recursive: true });

    fs.writeFileSync(path.join(schemaDir2, "Thing2.ts"), `
      export interface Thing2 { name: string; }
    `);

    const schemas = toJsonSchemasFromFiles(
      [path.join(schemaDir2, "Thing2.ts")],
      { includeSchema: false }
    );

    expect(schemas.Thing2.$schema).toBeUndefined();
  });
});
