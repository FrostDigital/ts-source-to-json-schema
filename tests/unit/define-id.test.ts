import { describe, it, expect } from "@jest/globals";
import { toJsonSchemas } from "../../src/index.js";

describe("defineId option", () => {
  it("should add $id to each schema", () => {
    const source = `
      interface User { name: string; }
      interface Post { title: string; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
    });

    expect(schemas["schemas.User"].$id).toBe("schemas.User");
    expect(schemas["schemas.Post"].$id).toBe("schemas.Post");
  });

  it("should use $id as record key", () => {
    const source = `
      interface User { name: string; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `my.ns.${name}`,
    });

    expect(Object.keys(schemas)).toEqual(["my.ns.User"]);
    expect(schemas["my.ns.User"]).toBeDefined();
  });

  it("should use external $ref instead of #/definitions/", () => {
    const source = `
      interface User { id: string; name: string; }
      interface Post { title: string; author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
    });

    // Post should reference User via external $ref
    expect(schemas["schemas.Post"].properties).toMatchObject({
      title: { type: "string" },
      author: { $ref: "schemas.User" },
    });
  });

  it("should not include definitions block when defineId is set", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
    });

    expect(schemas["schemas.Post"].definitions).toBeUndefined();
    expect(schemas["schemas.User"].definitions).toBeUndefined();
  });

  it("should handle self-referential types with external $ref", () => {
    const source = `
      interface TreeNode {
        value: string;
        children: TreeNode[];
      }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
    });

    const treeSchema = schemas["schemas.TreeNode"];
    expect(treeSchema.$id).toBe("schemas.TreeNode");
    expect(treeSchema.definitions).toBeUndefined();

    // The self-reference should use external $ref
    expect(treeSchema.properties!.children).toMatchObject({
      type: "array",
      items: { $ref: "schemas.TreeNode" },
    });
  });

  it("should include $schema by default", () => {
    const source = `interface User { name: string; }`;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
    });

    expect(schemas["schemas.User"].$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema"
    );
  });

  it("should respect includeSchema: false", () => {
    const source = `interface User { name: string; }`;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
      includeSchema: false,
    });

    expect(schemas["schemas.User"].$schema).toBeUndefined();
  });

  it("should work alongside defineNameTransform", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineNameTransform: (name) => `NS_${name}`,
      defineId: (name) => `schemas.${name}`,
    });

    // Key should be $id (defineId), not the transformed name
    expect(Object.keys(schemas)).toContain("schemas.User");
    expect(Object.keys(schemas)).toContain("schemas.Post");

    // External $ref should use the $id of the referenced type
    expect(schemas["schemas.Post"].properties).toMatchObject({
      author: { $ref: "schemas.User" },
    });
  });

  it("should throw on duplicate $id values", () => {
    const source = `
      interface User { name: string; }
      interface Post { title: string; }
    `;

    expect(() =>
      toJsonSchemas(source, {
        defineId: () => "same-id",
      })
    ).toThrow(/defineId produced duplicate id "same-id"/);
  });

  it("should throw when callback throws", () => {
    const source = `interface User { name: string; }`;

    expect(() =>
      toJsonSchemas(source, {
        defineId: () => { throw new Error("boom"); },
      })
    ).toThrow(/defineId callback threw error for type "User": boom/);
  });

  it("should receive declaration info in callback", () => {
    const source = `
      interface User { id: string; }
      type UserId = string;
      enum Role { Admin, User }
    `;

    const calls: Array<{ name: string; kind: string }> = [];

    toJsonSchemas(source, {
      defineId: (name, decl) => {
        calls.push({ name, kind: decl.kind });
        return name;
      },
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        { name: "User", kind: "interface" },
        { name: "UserId", kind: "type_alias" },
        { name: "Role", kind: "enum" },
      ])
    );
  });

  it("should pass undefined context for string-based APIs", () => {
    const source = `interface User { id: string; }`;
    let receivedContext: any = "not-called";

    toJsonSchemas(source, {
      defineId: (_name, _decl, context) => {
        receivedContext = context;
        return "User";
      },
    });

    expect(receivedContext).toBeUndefined();
  });

  it("should not affect behavior when defineId is not set", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    const schemas = toJsonSchemas(source);

    // Should use internal #/definitions/ refs
    expect(schemas["Post"].properties).toMatchObject({
      author: { $ref: "#/definitions/User" },
    });

    // Should have definitions block
    expect(schemas["Post"].definitions).toBeDefined();
    expect(schemas["Post"].definitions!.User).toBeDefined();
  });

  it("should handle enum types", () => {
    const source = `
      enum Role { Admin = "admin", User = "user" }
      interface User { role: Role; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `types.${name}`,
    });

    expect(schemas["types.Role"].$id).toBe("types.Role");
    expect(schemas["types.Role"].enum).toEqual(["admin", "user"]);

    expect(schemas["types.User"].properties).toMatchObject({
      role: { $ref: "types.Role" },
    });
    expect(schemas["types.User"].definitions).toBeUndefined();
  });

  it("should handle type aliases", () => {
    const source = `
      type Status = "active" | "inactive";
      interface User { status: Status; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `api.${name}`,
    });

    expect(schemas["api.Status"].$id).toBe("api.Status");
    expect(schemas["api.User"].properties).toMatchObject({
      status: { $ref: "api.Status" },
    });
  });

  it("should handle transitive references with external $ref", () => {
    const source = `
      interface Address { street: string; }
      interface User { address: Address; }
      interface Post { author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `s.${name}`,
    });

    // Post → User (external $ref)
    expect(schemas["s.Post"].properties!.author).toEqual({ $ref: "s.User" });
    expect(schemas["s.Post"].definitions).toBeUndefined();

    // User → Address (external $ref)
    expect(schemas["s.User"].properties!.address).toEqual({ $ref: "s.Address" });
    expect(schemas["s.User"].definitions).toBeUndefined();
  });

  it("should skip generic declarations with unresolved type parameters", () => {
    const source = `
      interface PaginatedResponse<T> {
        items: T[];
        total: number;
      }
      interface User { id: string; name: string; }
    `;

    const schemas = toJsonSchemas(source, {
      defineId: (name) => `schemas.${name}`,
    });

    // Generic PaginatedResponse<T> should NOT be emitted
    expect(schemas["schemas.PaginatedResponse"]).toBeUndefined();

    // User should still be emitted
    expect(schemas["schemas.User"]).toBeDefined();
    expect(schemas["schemas.User"].$id).toBe("schemas.User");
  });

  it("should skip generic declarations in batch mode without defineId too", () => {
    const source = `
      interface PaginatedResponse<T> {
        items: T[];
        total: number;
      }
      interface User { id: string; name: string; }
    `;

    const schemas = toJsonSchemas(source);

    // Generic PaginatedResponse<T> should NOT be emitted
    expect(schemas["PaginatedResponse"]).toBeUndefined();

    // User should still be emitted
    expect(schemas["User"]).toBeDefined();
  });
});
