import { describe, it, expect } from "@jest/globals";
import { toJsonSchema, parseDeclarations } from "../../src/index.js";

describe("Type parameter parsing", () => {
  it("should expose typeParams on interface declarations", () => {
    const decls = parseDeclarations(`
      interface Box<T> { value: T }
    `);
    expect(decls).toHaveLength(1);
    expect((decls[0] as any).typeParams).toEqual(["T"]);
  });

  it("should expose typeParams on type alias declarations", () => {
    const decls = parseDeclarations(`
      type Pair<A, B> = { first: A; second: B };
    `);
    expect((decls[0] as any).typeParams).toEqual(["A", "B"]);
  });

  it("should parse type parameters with constraints", () => {
    const decls = parseDeclarations(`
      interface Keyed<TKey extends string, TValue> { key: TKey; value: TValue }
    `);
    expect((decls[0] as any).typeParams).toEqual(["TKey", "TValue"]);
  });

  it("should parse type parameters with defaults", () => {
    const decls = parseDeclarations(`
      interface Wrapper<T = string, U = number> { a: T; b: U }
    `);
    expect((decls[0] as any).typeParams).toEqual(["T", "U"]);
  });

  it("should parse constraints containing nested generics", () => {
    const decls = parseDeclarations(`
      interface Lookup<T extends Record<string, number>, U> { map: T; other: U }
    `);
    expect((decls[0] as any).typeParams).toEqual(["T", "U"]);
  });

  it("should leave typeParams undefined for non-generic declarations", () => {
    const decls = parseDeclarations(`
      interface Plain { name: string }
    `);
    expect((decls[0] as any).typeParams).toBeUndefined();
  });
});

describe("Generic instantiation with non-conventional parameter names", () => {
  it("should instantiate a generic interface with a TData parameter", () => {
    const source = `
      interface ApiResponse<TData> { data: TData; status: number }
      interface User { name: string }
      export interface UserResponse extends ApiResponse<User> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "UserResponse" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        data: { $ref: "#/$defs/User" },
        status: { type: "number" },
      },
      required: ["data", "status"],
      $defs: {
        User: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    });
  });

  it("should instantiate a generic type alias with custom parameter names", () => {
    const source = `
      type Pair<First, Second> = { first: First; second: Second };
      export interface Entry extends Pair<string, number> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Entry" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        first: { type: "string" },
        second: { type: "number" },
      },
      required: ["first", "second"],
    });
  });

  it("should instantiate generics with constrained parameters", () => {
    const source = `
      interface Labelled<TLabel extends string> { label: TLabel }
      export interface Named extends Labelled<"name"> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Named" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        label: { const: "name" },
      },
      required: ["label"],
    });
  });

  it("should not treat a non-generic type referencing a type named T as generic", () => {
    // The old implementation guessed parameter names from a hardcoded list
    // (T, U, V, W, K, ...) and silently dropped declarations that referenced
    // a real user-defined type with one of those names.
    const source = `
      interface T { x: string }
      export interface Uses { t: T }
    `;
    const schema = toJsonSchema(source, { includeSchema: false });
    expect(schema.$defs?.Uses).toEqual({
      type: "object",
      properties: { t: { $ref: "#/$defs/T" } },
      required: ["t"],
    });
    expect(schema.$defs?.T).toEqual({
      type: "object",
      properties: { x: { type: "string" } },
      required: ["x"],
    });
  });

  it("should still exclude generic declarations from $defs output", () => {
    const source = `
      interface Box<TItem> { value: TItem }
      export interface StringBox extends Box<string> {}
    `;
    const schema = toJsonSchema(source, { includeSchema: false });
    expect(schema.$defs?.Box).toBeUndefined();
    expect(schema.$defs?.StringBox).toEqual({
      type: "object",
      properties: { value: { type: "string" } },
      required: ["value"],
    });
  });
});
