import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { toJsonSchemaFromFile, toJsonSchemasFromFile } from "../../src/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("defineNameTransform with file-based APIs", () => {
  const fixturesDir = path.join(__dirname, "fixtures", "define-name-transform");

  beforeAll(() => {
    // Create fixtures directory
    fs.mkdirSync(fixturesDir, { recursive: true });

    // Create user.ts
    fs.writeFileSync(
      path.join(fixturesDir, "user.ts"),
      `export interface User {
  id: string;
  name: string;
}`
    );

    // Create post.ts that imports User
    fs.writeFileSync(
      path.join(fixturesDir, "post.ts"),
      `import { User } from "./user";

export interface Post {
  title: string;
  author: User;
}`
    );

    // Create nested directory
    fs.mkdirSync(path.join(fixturesDir, "models"), { recursive: true });

    // Create models/entity.ts
    fs.writeFileSync(
      path.join(fixturesDir, "models", "entity.ts"),
      `export interface Entity {
  id: string;
  createdAt: Date;
}`
    );

    // Create models/product.ts that imports Entity
    fs.writeFileSync(
      path.join(fixturesDir, "models", "product.ts"),
      `import { Entity } from "./entity";

export interface Product extends Entity {
  name: string;
  price: number;
}`
    );
  });

  afterAll(() => {
    // Clean up fixtures
    fs.rmSync(fixturesDir, { recursive: true, force: true });
  });

  it("should pass undefined context for followImports: 'none'", () => {
    const userFile = path.join(fixturesDir, "user.ts");
    let receivedContext: any = "not-called";

    toJsonSchemaFromFile(userFile, {
      rootType: "User",
      followImports: "none", // Single-file mode
      defineNameTransform: (name, decl, context) => {
        receivedContext = context;
        return name;
      }
    });

    // followImports: 'none' uses string-based API internally, so no context
    expect(receivedContext).toBeUndefined();
  });

  it("should receive file context with followImports: 'local'", () => {
    const userFile = path.join(fixturesDir, "user.ts");
    const receivedContexts: Array<{ name: string; absolutePath?: string; relativePath?: string }> = [];

    toJsonSchemaFromFile(userFile, {
      rootType: "User",
      followImports: "local",
      defineNameTransform: (name, decl, context) => {
        receivedContexts.push({
          name,
          absolutePath: context?.absolutePath,
          relativePath: context?.relativePath
        });
        return name;
      }
    });

    expect(receivedContexts).toHaveLength(1);
    expect(receivedContexts[0].name).toBe("User");
    expect(receivedContexts[0].absolutePath).toBe(userFile);
    expect(receivedContexts[0].relativePath).toBeTruthy();

    // relativePath should be relative to cwd
    const expectedRelative = path.relative(process.cwd(), userFile);
    expect(receivedContexts[0].relativePath).toBe(expectedRelative);
  });

  it("should namespace types by file using toJsonSchemasFromFile", () => {
    const postFile = path.join(fixturesDir, "post.ts");

    const schemas = toJsonSchemasFromFile(postFile, {
      followImports: "local",
      defineNameTransform: (name, decl, context) => {
        if (!context) return name;

        // Simple file-based namespace
        const filename = path.basename(context.relativePath, ".ts");
        return `${filename}_${name}`;
      }
    });

    expect(schemas.post_Post).toBeDefined();
    expect(schemas.user_User).toBeDefined();

    // Check that internal reference is transformed
    expect(schemas.post_Post).toMatchObject({
      type: "object",
      properties: {
        title: { type: "string" },
        author: { $ref: "#/definitions/user_User" }
      }
    });
  });

  it("should use absolutePath when needed", () => {
    const userFile = path.join(fixturesDir, "user.ts");
    let receivedAbsolutePath: string | undefined;

    toJsonSchemaFromFile(userFile, {
      rootType: "User",
      followImports: "local",
      defineNameTransform: (name, decl, context) => {
        receivedAbsolutePath = context?.absolutePath;
        return name;
      }
    });

    expect(receivedAbsolutePath).toBe(userFile);
    expect(path.isAbsolute(receivedAbsolutePath!)).toBe(true);
  });

  it("should provide context to callback for each file in batch generation", () => {
    const postFile = path.join(fixturesDir, "post.ts");
    const receivedContexts = new Map<string, { absolutePath: string; relativePath: string }>();

    toJsonSchemasFromFile(postFile, {
      followImports: "local",
      defineNameTransform: (name, decl, context) => {
        if (context) {
          receivedContexts.set(name, context);
        }
        return name;
      }
    });

    // Should have context for both Post and User
    expect(receivedContexts.has("Post")).toBe(true);
    expect(receivedContexts.has("User")).toBe(true);

    // Post should have post.ts path
    expect(receivedContexts.get("Post")!.absolutePath).toBe(postFile);

    // User should have user.ts path
    const userFile = path.join(fixturesDir, "user.ts");
    expect(receivedContexts.get("User")!.absolutePath).toBe(userFile);
  });

  it("should handle real-world Flink-style namespacing", () => {
    // Simulate Flink's use case: namespace by relative path from project root
    const schemas = toJsonSchemasFromFile(path.join(fixturesDir, "post.ts"), {
      followImports: "local",
      defineNameTransform: (name, decl, context) => {
        if (!context) return name;

        // Convert path to namespace: tests/integration/fixtures/define-name-transform/post.ts
        // becomes: tests_integration_fixtures_define_name_transform_post_Post
        const namespace = context.relativePath
          .replace(/\.ts$/, "")
          .split(path.sep)
          .join("_");

        return `${namespace}_${name}`;
      }
    });

    // Keys should have full namespace
    const keys = Object.keys(schemas);
    expect(keys.length).toBe(2);
    // At least one key should have the full path (varies by OS)
    expect(keys.some(k => k.includes("fixtures") || k.includes("define"))).toBe(true);
  });
});
