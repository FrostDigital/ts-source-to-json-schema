import { describe, it, expect } from "@jest/globals";
import { toJsonSchema } from "../../src/index.js";

describe("Generic Type Instantiation", () => {
  it("should instantiate generic with inline object type argument", () => {
    const source = `
      interface PaginatedResponse<T> {
        items: T[];
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
      }
      export interface UserList extends PaginatedResponse<{name: string}> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "UserList" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" }
            },
            required: ["name"]
          }
        },
        total: { type: "number" },
        limit: { type: "number" },
        offset: { type: "number" },
        hasMore: { type: "boolean" }
      },
      required: ["items", "total", "limit", "offset", "hasMore"]
    });
  });

  it("should instantiate generic with reference type argument", () => {
    const source = `
      interface Box<T> { value: T }
      interface User { name: string }
      export interface UserBox extends Box<User> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "UserBox" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        value: { $ref: "#/$defs/User" }
      },
      required: ["value"],
      $defs: {
        User: {
          type: "object",
          properties: {
            name: { type: "string" }
          },
          required: ["name"]
        }
      }
    });
  });

  it("should instantiate generic with primitive type argument", () => {
    const source = `
      interface Container<T> { data: T }
      export interface StringContainer extends Container<string> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "StringContainer" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        data: { type: "string" }
      },
      required: ["data"]
    });
  });

  it("should instantiate generic with multiple type parameters", () => {
    const source = `
      interface Pair<T, U> { key: T; value: U }
      export interface NameAge extends Pair<string, number> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "NameAge" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        key: { type: "string" },
        value: { type: "number" }
      },
      required: ["key", "value"]
    });
  });

  it("should handle type alias using generic", () => {
    const source = `
      interface Response<T> { data: T }
      export type UserResponse = Response<{id: number}>
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "UserResponse" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            id: { type: "number" }
          },
          required: ["id"]
        }
      },
      required: ["data"]
    });
  });

  it("should fall back to $ref when generic has no type args", () => {
    const source = `
      interface Box<T> { value: T }
      export interface Container extends Box {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Container" });
    expect(schema).toEqual({
      $ref: "#/$defs/Box",
      $defs: {
        Box: {
          type: "object",
          properties: {
            value: { $ref: "#/$defs/T" }
          },
          required: ["value"]
        }
      }
    });
  });

  it("should handle nested generics", () => {
    const source = `
      interface Box<T> { value: T }
      export interface DoubleBox extends Box<Box<string>> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "DoubleBox" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        value: {
          type: "object",
          properties: {
            value: { type: "string" }
          },
          required: ["value"]
        }
      },
      required: ["value"]
    });
  });
});
