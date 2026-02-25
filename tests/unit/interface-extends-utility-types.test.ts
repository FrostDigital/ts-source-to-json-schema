import { describe, it, expect } from "@jest/globals";
import { toJsonSchema } from "../../src/index.js";

describe("Interface Extends Utility Types", () => {
  it("should support Omit utility type in extends clause", () => {
    const source = `
      export interface Pet {
        _id: string;
        name: string;
        species: string;
        created: number;
      }

      export interface PostPetReq extends Omit<Pet, "_id" | "created"> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    // PostPetReq should have only name and species (Pet minus _id and created)
    expect(schema.$defs?.PostPetReq).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        species: { type: "string" },
      },
      required: ["name", "species"],
    });
  });

  it("should support Pick utility type in extends clause", () => {
    const source = `
      export interface User {
        id: string;
        name: string;
        email: string;
        password: string;
      }

      export interface UserSummary extends Pick<User, "name" | "email"> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    expect(schema.$defs?.UserSummary).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
      },
      required: ["name", "email"],
    });
  });

  it("should support Partial utility type in extends clause", () => {
    const source = `
      export interface Config {
        host: string;
        port: number;
      }

      export interface OptionalConfig extends Partial<Config> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    // All properties are optional, so no required array
    expect(schema.$defs?.OptionalConfig).toEqual({
      type: "object",
      properties: {
        host: { type: "string" },
        port: { type: "number" },
      },
    });
  });

  it("should support Required utility type in extends clause", () => {
    const source = `
      export interface PartialData {
        name?: string;
        age?: number;
      }

      export interface CompleteData extends Required<PartialData> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    expect(schema.$defs?.CompleteData).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    });
  });

  it("should support multiple extends with utility types", () => {
    const source = `
      export interface A {
        x: string;
        y: number;
      }

      export interface B {
        y: number;
        z: boolean;
      }

      export interface Mixed extends Omit<A, "x">, Pick<B, "z"> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    expect(schema.$defs?.Mixed).toEqual({
      allOf: [
        {
          type: "object",
          properties: {
            y: { type: "number" },
          },
          required: ["y"],
        },
        {
          type: "object",
          properties: {
            z: { type: "boolean" },
          },
          required: ["z"],
        },
      ],
    });
  });

  it("should support utility type mixed with simple extends", () => {
    const source = `
      export interface Base {
        base: string;
      }

      export interface Extra {
        id: string;
        extra: number;
      }

      export interface Combined extends Base, Omit<Extra, "id"> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    expect(schema.$defs?.Combined).toEqual({
      allOf: [
        { $ref: "#/$defs/Base" },
        {
          type: "object",
          properties: {
            extra: { type: "number" },
          },
          required: ["extra"],
        },
      ],
    });
  });

  it("should support interface with additional properties after utility type extends", () => {
    const source = `
      export interface Pet {
        _id: string;
        name: string;
        species: string;
      }

      export interface PostPetReq extends Omit<Pet, "_id"> {
        ownerEmail: string;
      }
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    expect(schema.$defs?.PostPetReq).toEqual({
      allOf: [
        {
          type: "object",
          properties: {
            name: { type: "string" },
            species: { type: "string" },
          },
          required: ["name", "species"],
        },
        {
          type: "object",
          properties: {
            ownerEmail: { type: "string" },
          },
          required: ["ownerEmail"],
        },
      ],
    });
  });

  it("should support Record utility type in extends clause", () => {
    const source = `
      export interface StringMap extends Record<string, string> {}
    `;

    const schema = toJsonSchema(source, { includeSchema: false });

    expect(schema.$defs?.StringMap).toEqual({
      type: "object",
      additionalProperties: { type: "string" },
    });
  });
});
