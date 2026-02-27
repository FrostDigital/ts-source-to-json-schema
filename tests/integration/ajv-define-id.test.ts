import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { toJsonSchemas, toJsonSchemasFromFiles } from "../../src/index.js";

describe("defineId with AJV integration", () => {
  it("should validate cross-referencing schemas via AJV global registry", () => {
    const source = `
      interface User { id: string; name: string; }
      interface Post { title: string; author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
      includeSchema: false,
    });

    const ajv = new Ajv();
    for (const schema of Object.values(schemas)) {
      ajv.addSchema(schema);
    }

    const validatePost = ajv.getSchema("schemas.Post")!;

    expect(
      validatePost({ title: "Hello", author: { id: "1", name: "Joel" } }),
    ).toBe(true);
    expect(
      validatePost({ title: "Hello", author: { id: 123, name: "Joel" } }),
    ).toBe(false);
    expect(validatePost({ title: "Hello" })).toBe(false); // author is required
  });

  it("should validate with required fields", () => {
    const source = `
      interface User { id: string; name: string; }
      interface Post { title: string; author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
      includeSchema: false,
    });

    const ajv = new Ajv();
    for (const schema of Object.values(schemas)) {
      ajv.addSchema(schema);
    }

    const validatePost = ajv.getSchema("schemas.Post")!;

    // Both title and author are required (non-optional)
    expect(
      validatePost({ title: "Hello", author: { id: "1", name: "Joel" } }),
    ).toBe(true);
    expect(validatePost({ title: "Hello" })).toBe(false);
    expect(validatePost({})).toBe(false);
  });

  it("should validate deeply nested cross-references", () => {
    const source = `
      interface Address { street: string; city: string; }
      interface User { name: string; address: Address; }
      interface Post { title: string; author: User; }
      interface Feed { posts: Post[]; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `app.${name}`,
      includeSchema: false,
    });

    const ajv = new Ajv();
    for (const schema of Object.values(schemas)) {
      ajv.addSchema(schema);
    }

    const validateFeed = ajv.getSchema("app.Feed")!;

    expect(
      validateFeed({
        posts: [
          {
            title: "Hello",
            author: {
              name: "Joel",
              address: { street: "123 Main", city: "Stockholm" },
            },
          },
        ],
      }),
    ).toBe(true);

    // Invalid: address.city is not a string
    expect(
      validateFeed({
        posts: [
          {
            title: "Hello",
            author: {
              name: "Joel",
              address: { street: "123 Main", city: 42 },
            },
          },
        ],
      }),
    ).toBe(false);
  });

  it("should validate self-referential types", () => {
    const source = `
      interface TreeNode {
        value: string;
        children?: TreeNode[];
      }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `tree.${name}`,
      includeSchema: false,
    });

    const ajv = new Ajv();
    for (const schema of Object.values(schemas)) {
      ajv.addSchema(schema);
    }

    const validate = ajv.getSchema("tree.TreeNode")!;

    expect(
      validate({
        value: "root",
        children: [
          { value: "child1" },
          { value: "child2", children: [{ value: "grandchild" }] },
        ],
      }),
    ).toBe(true);

    expect(validate({ value: 42 })).toBe(false);
  });

  it("should validate with enums across schemas", () => {
    const source = `
      enum Role { Admin = "admin", User = "user" }
      interface User { name: string; role: Role; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `auth.${name}`,
      includeSchema: false,
    });

    const ajv = new Ajv();
    for (const schema of Object.values(schemas)) {
      ajv.addSchema(schema);
    }

    const validate = ajv.getSchema("auth.User")!;

    expect(validate({ name: "Joel", role: "admin" })).toBe(true);
    expect(validate({ name: "Joel", role: "superadmin" })).toBe(false);
  });

  it("should validate with strictObjects", () => {
    const source = `
      interface Config { host: string; port: number; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `cfg.${name}`,
      includeSchema: false,
      strictObjects: true,
    });

    const ajv = new Ajv();
    for (const schema of Object.values(schemas)) {
      ajv.addSchema(schema);
    }

    const validate = ajv.getSchema("cfg.Config")!;

    expect(validate({ host: "localhost", port: 3000 })).toBe(true);
    expect(validate({ host: "localhost", port: 3000, extra: true })).toBe(
      false,
    );
  });

  describe("multi-file with file-path-based $id", () => {
    let tempDir: string;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ajv-define-id-test-"));

      // src/models/User.ts
      const modelsDir = path.join(tempDir, "src", "models");
      fs.mkdirSync(modelsDir, { recursive: true });
      fs.writeFileSync(
        path.join(modelsDir, "User.ts"),
        `
        export interface User {
          id: string;
          name: string;
          email: string;
        }
      `,
      );

      // src/models/Post.ts — imports User
      fs.writeFileSync(
        path.join(modelsDir, "Post.ts"),
        `
        import { User } from "./User";
        export interface Post {
          title: string;
          body: string;
          author: User;
        }
      `,
      );

      // src/models/PaginatedResponse.ts — generic type
      fs.writeFileSync(
        path.join(modelsDir, "PaginatedResponse.ts"),
        `
        export interface PaginatedResponse<T> {
          items: T[];
          total: number;
          page: number;
          pageSize: number;
        }
      `,
      );

      // src/api/CreatePostReq.ts — imports Post, uses Omit
      const apiDir = path.join(tempDir, "src", "api");
      fs.mkdirSync(apiDir, { recursive: true });
      fs.writeFileSync(
        path.join(apiDir, "CreatePostReq.ts"),
        `
        import { Post } from "../models/Post";
        export interface CreatePostReq extends Omit<Post, "author"> {
          authorId: string;
        }
      `,
      );

      // src/api/UserList.ts — imports PaginatedResponse and User, uses generic as property
      fs.writeFileSync(
        path.join(apiDir, "UserList.ts"),
        `
        import { PaginatedResponse } from "../models/PaginatedResponse";
        import { User } from "../models/User";
        export interface UserList {
          time: Date;
          page: PaginatedResponse<User>;
        }
      `,
      );
    });

    afterAll(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should use file path in $id and validate cross-file refs with AJV", () => {
      const schemas = toJsonSchemasFromFiles(
        path.join(tempDir, "src/**/*.ts"),
        {
          followImports: "local",
          includeSchema: false,
          defineId: (name, _decl, ctx) => {
            if (!ctx) return name;
            const fileStem = ctx.relativePath
              .replace(/\.ts$/, "")
              .replace(/\//g, ".");
            return `${fileStem}.${name}`;
          },
        },
      );

      // Verify keys use file-path-based $id
      const keys = Object.keys(schemas);
      const userKey = keys.find((k) => k.endsWith(".User"))!;
      const postKey = keys.find((k) => k.endsWith(".Post"))!;
      const createPostKey = keys.find((k) => k.endsWith(".CreatePostReq"))!;

      expect(userKey).toContain("models");
      expect(postKey).toContain("models");
      expect(createPostKey).toContain("api");

      // Verify $id fields match keys
      expect(schemas[userKey].$id).toBe(userKey);
      expect(schemas[postKey].$id).toBe(postKey);
      expect(schemas[createPostKey].$id).toBe(createPostKey);

      // Verify Post references User via external $ref (not #/definitions/)
      expect(schemas[postKey].properties!.author.$ref).toBe(userKey);
      expect(schemas[postKey].definitions).toBeUndefined();

      // Register all with AJV (with format support for Date → date-time)
      const ajv = addFormats(new Ajv());
      for (const schema of Object.values(schemas)) {
        ajv.addSchema(schema);
      }

      // Validate User
      const validateUser = ajv.getSchema(userKey)!;
      expect(
        validateUser({ id: "1", name: "Joel", email: "joel@test.com" }),
      ).toBe(true);
      expect(validateUser({ id: "1", name: "Joel" })).toBe(false); // missing email

      // Validate Post — AJV resolves User from registry
      const validatePost = ajv.getSchema(postKey)!;
      expect(
        validatePost({
          title: "Hello",
          body: "World",
          author: { id: "1", name: "Joel", email: "joel@test.com" },
        }),
      ).toBe(true);
      expect(
        validatePost({
          title: "Hello",
          body: "World",
          author: { id: "1", name: "Joel" }, // missing email
        }),
      ).toBe(false);

      // Validate CreatePostReq — Omit<Post, "author"> + authorId
      const validateCreatePost = ajv.getSchema(createPostKey)!;
      expect(
        validateCreatePost({
          title: "Hello",
          body: "World",
          authorId: "user-1",
        }),
      ).toBe(true);
      expect(
        validateCreatePost({
          title: "Hello",
          body: "World",
          // missing authorId
        }),
      ).toBe(false);

      // Validate UserList — has time: Date and page: PaginatedResponse<User> (instantiated inline)
      const userListKey = keys.find((k) => k.endsWith(".UserList"))!;
      expect(userListKey).toContain("api");
      expect(schemas[userListKey].$id).toBe(userListKey);

      // PaginatedResponse<T> is generic, should NOT appear as its own schema
      const paginatedKey = keys.find((k) => k.includes("PaginatedResponse"));
      expect(paginatedKey).toBeUndefined();

      const validateUserList = ajv.getSchema(userListKey)!;
      expect(
        validateUserList({
          time: "2026-02-26T10:00:00.000Z",
          page: {
            items: [
              { id: "1", name: "Joel", email: "joel@test.com" },
              { id: "2", name: "Anna", email: "anna@test.com" },
            ],
            total: 2,
            page: 1,
            pageSize: 10,
          },
        }),
      ).toBe(true);

      // Invalid: page.items contain invalid User (missing email)
      expect(
        validateUserList({
          time: "2026-02-26T10:00:00.000Z",
          page: {
            items: [{ id: "1", name: "Joel" }],
            total: 1,
            page: 1,
            pageSize: 10,
          },
        }),
      ).toBe(false);

      // Invalid: missing required page field
      expect(
        validateUserList({
          time: "2026-02-26T10:00:00.000Z",
        }),
      ).toBe(false);

      // Invalid: time is not a date-time string
      expect(
        validateUserList({
          time: 12345,
          page: { items: [], total: 0, page: 1, pageSize: 10 },
        }),
      ).toBe(false);
    });
  });
});
