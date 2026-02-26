import { describe, it, expect } from "@jest/globals";
import { toJsonSchema, toJsonSchemas } from "../../src/index.js";

describe("defineNameTransform option", () => {
  it("should transform type names with simple prefix", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    const schema = toJsonSchema(source, {
      rootType: "Post",
      defineNameTransform: (name) => `NS_${name}`
    });

    // Post is not self-referential, so it's emitted inline
    expect(schema.type).toBe("object");
    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.NS_User).toBeDefined();

    // Check that the reference to User is also transformed
    expect(schema).toMatchObject({
      type: "object",
      properties: {
        author: { $ref: "#/$defs/NS_User" }
      }
    });
  });

  it("should transform with suffix", () => {
    const source = `interface User { name: string; }`;

    const schema = toJsonSchema(source, {
      rootType: "User",
      defineNameTransform: (name) => `${name}_v2`
    });

    // User is not self-referential, emitted inline
    expect(schema.type).toBe("object");
    expect(schema.properties).toMatchObject({
      name: { type: "string" }
    });
  });

  it("should receive correct parameters in callback", () => {
    const source = `
      interface User { id: string; }
      type UserId = string;
      enum Role { Admin, User }
    `;

    const receivedCalls: Array<{ name: string; kind: string; context?: any }> = [];

    toJsonSchema(source, {
      defineNameTransform: (name, decl, context) => {
        receivedCalls.push({ name, kind: decl.kind, context });
        return name;
      }
    });

    // Should be called for all three types
    expect(receivedCalls).toHaveLength(3);
    expect(receivedCalls).toEqual(
      expect.arrayContaining([
        { name: "User", kind: "interface", context: undefined },
        { name: "UserId", kind: "type_alias", context: undefined },
        { name: "Role", kind: "enum", context: undefined }
      ])
    );
  });

  it("should pass undefined context for string-based APIs", () => {
    const source = `interface User { id: string; }`;
    let receivedContext: any = "not-called";

    toJsonSchema(source, {
      rootType: "User",
      defineNameTransform: (name, decl, context) => {
        receivedContext = context;
        return name;
      }
    });

    expect(receivedContext).toBeUndefined();
  });

  it("should detect and throw error on name collisions", () => {
    const source = `
      interface User { id: string; }
      interface Post { title: string; }
    `;

    expect(() => {
      toJsonSchema(source, {
        defineNameTransform: () => "SameName"
      });
    }).toThrow(/duplicate name.*SameName.*User, Post/i);
  });

  it("should throw error with context when callback throws", () => {
    const source = `interface User { id: string; }`;

    expect(() => {
      toJsonSchema(source, {
        defineNameTransform: (name) => {
          throw new Error("Transform failed");
        }
      });
    }).toThrow(/defineNameTransform callback threw error for type "User".*Transform failed/);
  });

  it("should work with batch generation (toJsonSchemas)", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    const schemas = toJsonSchemas(source, {
      defineNameTransform: (name) => `Prefixed_${name}`
    });

    expect(schemas.Prefixed_User).toBeDefined();
    expect(schemas.Prefixed_Post).toBeDefined();

    // Check that internal references are also transformed
    expect(schemas.Prefixed_Post).toMatchObject({
      type: "object",
      properties: {
        author: { $ref: "#/definitions/Prefixed_User" }
      }
    });
  });

  it("should work with recursive types", () => {
    const source = `
      interface TreeNode {
        value: number;
        children?: TreeNode[];
      }
    `;

    const schema = toJsonSchema(source, {
      rootType: "TreeNode",
      defineNameTransform: (name) => `Tree_${name}`
    });

    // TreeNode IS self-referential, so it should have $ref at root
    expect(schema.$ref).toBe("#/$defs/Tree_TreeNode");
    expect(schema.$defs!.Tree_TreeNode).toBeDefined();

    const treeSchema = schema.$defs!.Tree_TreeNode;
    expect(treeSchema).toMatchObject({
      type: "object",
      properties: {
        value: { type: "number" },
        children: {
          type: "array",
          items: { $ref: "#/$defs/Tree_TreeNode" }
        }
      }
    });
  });

  it("should not transform built-in types", () => {
    const source = `
      interface User {
        id: string;
        createdAt: Date;
      }
    `;

    const schema = toJsonSchema(source, {
      rootType: "User",
      defineNameTransform: (name) => `NS_${name}`
    });

    // User is not self-referential, emitted inline
    expect(schema).toMatchObject({
      type: "object",
      properties: {
        id: { type: "string" },
        createdAt: { type: "string", format: "date-time" }
      }
    });
  });

  it("should work with utility types (Partial, Pick, etc.)", () => {
    const source = `
      interface User { id: string; name: string; email: string; }
      type PartialUser = Partial<User>;
      type UserName = Pick<User, "name">;
    `;

    const schema = toJsonSchema(source, {
      rootType: "PartialUser",
      defineNameTransform: (name) => `App_${name}`
    });

    // Partial<User> is inlined and all properties are optional
    expect(schema.type).toBe("object");
    expect(schema.$defs!.App_User).toBeDefined();

    // User should still be transformed in the defs
    const userSchema = schema.$defs!.App_User;
    expect(userSchema).toMatchObject({
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" }
      }
    });
  });

  it("should work with generic type instantiation", () => {
    const source = `
      interface Response<T> {
        data: T;
        status: number;
      }
      interface User { id: string; name: string; }
      interface UserResponse extends Response<User> {}
    `;

    const schema = toJsonSchema(source, {
      rootType: "UserResponse",
      defineNameTransform: (name) => `API_${name}`
    });

    // UserResponse extends Response<User>, so it's emitted inline
    expect(schema.type).toBe("object");
    expect(schema.$defs!.API_User).toBeDefined();

    const userSchema = schema.$defs!.API_User;
    expect(userSchema).toMatchObject({
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" }
      }
    });
  });

  it("should work with interface extends", () => {
    const source = `
      interface BaseEntity { id: string; }
      interface User extends BaseEntity { name: string; }
    `;

    const schema = toJsonSchema(source, {
      rootType: "User",
      defineNameTransform: (name) => `v2_${name}`
    });

    // User is not self-referential, emitted inline with allOf
    expect(schema.allOf).toBeDefined();
    expect(schema.$defs!.v2_BaseEntity).toBeDefined();
    expect(schema.allOf![0]).toEqual({ $ref: "#/$defs/v2_BaseEntity" });
  });

  it("should preserve original names for internal lookups", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    // Transform should not break internal resolution
    const schema = toJsonSchema(source, {
      rootType: "Post",
      defineNameTransform: (name) => `${name.toLowerCase()}_type`
    });

    // Post is not self-referential, emitted inline
    expect(schema.type).toBe("object");
    expect(schema.$defs!.user_type).toBeDefined();
    expect(schema.properties).toMatchObject({
      author: { $ref: "#/$defs/user_type" }
    });
  });

  it("should work with enums", () => {
    const source = `
      enum Status { Active = "active", Inactive = "inactive" }
      interface User { status: Status; }
    `;

    const schema = toJsonSchema(source, {
      rootType: "User",
      defineNameTransform: (name) => `App_${name}`
    });

    // User is not self-referential, emitted inline
    expect(schema.type).toBe("object");
    expect(schema.$defs!.App_Status).toBeDefined();

    const statusSchema = schema.$defs!.App_Status;
    expect(statusSchema).toMatchObject({
      type: "string",
      enum: ["active", "inactive"]
    });
  });

  it("should work with union types containing references", () => {
    const source = `
      interface Cat { meow: string; }
      interface Dog { bark: string; }
      type Pet = Cat | Dog;
    `;

    const schema = toJsonSchema(source, {
      rootType: "Pet",
      defineNameTransform: (name) => `NS_${name}`
    });

    // Pet is not self-referential, emitted inline as anyOf
    expect(schema.anyOf).toBeDefined();
    expect(schema.$defs!.NS_Cat).toBeDefined();
    expect(schema.$defs!.NS_Dog).toBeDefined();
    expect(schema.anyOf).toContainEqual({ $ref: "#/$defs/NS_Cat" });
    expect(schema.anyOf).toContainEqual({ $ref: "#/$defs/NS_Dog" });
  });

  it("should work with intersection types", () => {
    const source = `
      interface Timestamped { createdAt: Date; }
      interface Named { name: string; }
      type Entity = Timestamped & Named;
    `;

    const schema = toJsonSchema(source, {
      rootType: "Entity",
      defineNameTransform: (name) => `v2_${name}`
    });

    // Entity is not self-referential, emitted inline as allOf
    expect(schema.allOf).toBeDefined();
    expect(schema.$defs!.v2_Timestamped).toBeDefined();
    expect(schema.$defs!.v2_Named).toBeDefined();
    expect(schema.allOf).toContainEqual({ $ref: "#/$defs/v2_Timestamped" });
    expect(schema.allOf).toContainEqual({ $ref: "#/$defs/v2_Named" });
  });

  it("should handle complex transformation logic based on declaration kind", () => {
    const source = `
      interface User { id: string; }
      type UserId = string;
      enum Role { Admin }
    `;

    const schema = toJsonSchema(source, {
      defineNameTransform: (name, decl) => {
        if (decl.kind === "interface") return `I${name}`;
        if (decl.kind === "type_alias") return `T${name}`;
        if (decl.kind === "enum") return `E${name}`;
        return name;
      }
    });

    expect(schema.$defs!.IUser).toBeDefined();
    expect(schema.$defs!.TUserId).toBeDefined();
    expect(schema.$defs!.ERole).toBeDefined();
  });

  it("should work when no transform is provided (backwards compatibility)", () => {
    const source = `
      interface User { id: string; }
      interface Post { author: User; }
    `;

    const schema = toJsonSchema(source, {
      rootType: "Post"
    });

    // Post is not self-referential, emitted inline
    expect(schema.type).toBe("object");
    expect(schema.$defs!.User).toBeDefined();
    expect(schema.properties).toMatchObject({
      author: { $ref: "#/$defs/User" }
    });
  });
});
