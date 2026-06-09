import { describe, it, expect } from "@jest/globals";
import { toJsonSchema } from "../../src/index.js";

describe("Function-typed members", () => {
  it("should omit function-typed properties instead of failing", () => {
    const source = `
      interface Config {
        name: string;
        onChange: (value: string) => void;
        timeout: number;
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Config" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        timeout: { type: "number" },
      },
      required: ["name", "timeout"],
    });
  });

  it("should omit method signatures instead of failing", () => {
    const source = `
      interface Repository {
        tableName: string;
        findById(id: string): string;
        save(entity: object): void;
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Repository" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        tableName: { type: "string" },
      },
      required: ["tableName"],
    });
  });

  it("should omit optional function properties and methods", () => {
    const source = `
      interface Hooks {
        id: string;
        beforeSave?: (entity: object) => void;
        afterSave?(entity: object): void;
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Hooks" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    });
  });

  it("should omit parenthesized function-typed properties", () => {
    const source = `
      interface Wrapper {
        label: string;
        callback: ((value: number) => string);
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Wrapper" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        label: { type: "string" },
      },
      required: ["label"],
    });
  });

  it("should handle function types with no parameters", () => {
    const source = `
      interface Lifecycle {
        state: string;
        dispose: () => void;
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Lifecycle" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        state: { type: "string" },
      },
      required: ["state"],
    });
  });

  it("should handle generic method signatures", () => {
    const source = `
      interface Collection {
        size: number;
        map<U>(fn: (item: string) => U): U[];
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Collection" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        size: { type: "number" },
      },
      required: ["size"],
    });
  });

  it("should handle function types with function-typed parameters", () => {
    const source = `
      interface Composer {
        name: string;
        compose: (fn: (x: number) => number) => (y: number) => number;
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Composer" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    });
  });

  it("should emit an empty schema for a type alias to a function type", () => {
    const source = `
      type Handler = (event: string) => void;
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Handler" });
    expect(schema).toEqual({});
  });

  it("should not affect parenthesized non-function types", () => {
    const source = `
      interface Item {
        value: (string | number);
      }
    `;
    const schema = toJsonSchema(source, { includeSchema: false, rootType: "Item" });
    expect(schema).toEqual({
      type: "object",
      properties: {
        value: { anyOf: [{ type: "string" }, { type: "number" }] },
      },
      required: ["value"],
    });
  });
});
