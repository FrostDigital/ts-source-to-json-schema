import { describe, it, expect } from "@jest/globals";
import Ajv from "ajv";
import { toJsonSchemas } from "../../src/index.js";

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

    expect(validatePost({ title: "Hello", author: { id: "1", name: "Joel" } })).toBe(true);
    expect(validatePost({ title: "Hello", author: { id: 123, name: "Joel" } })).toBe(false);
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
    expect(validatePost({ title: "Hello", author: { id: "1", name: "Joel" } })).toBe(true);
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

    expect(validateFeed({
      posts: [{
        title: "Hello",
        author: {
          name: "Joel",
          address: { street: "123 Main", city: "Stockholm" },
        },
      }],
    })).toBe(true);

    // Invalid: address.city is not a string
    expect(validateFeed({
      posts: [{
        title: "Hello",
        author: {
          name: "Joel",
          address: { street: "123 Main", city: 42 },
        },
      }],
    })).toBe(false);
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

    expect(validate({
      value: "root",
      children: [
        { value: "child1" },
        { value: "child2", children: [{ value: "grandchild" }] },
      ],
    })).toBe(true);

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
    expect(validate({ host: "localhost", port: 3000, extra: true })).toBe(false);
  });
});
