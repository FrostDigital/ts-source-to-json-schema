import { toJsonSchema } from "../../src/index.js";
import { describe, it, expect } from "@jest/globals";

describe("Enum Member Access", () => {
  it("should emit const for string enum member", () => {
    const source = `
      export enum Status {
        Active = "active",
        Inactive = "inactive"
      }

      export interface Foo {
        status: Status.Active;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.status).toEqual({ const: "active" });
    expect(schema.required).toEqual(["status"]);
  });

  it("should emit const for numeric enum member", () => {
    const source = `
      export enum Priority {
        Low = 1,
        Medium = 2,
        High = 3
      }

      export interface Task {
        priority: Priority.High;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Task" });
    expect(schema.properties?.priority).toEqual({ const: 3 });
    expect(schema.required).toEqual(["priority"]);
  });

  it("should handle optional property with enum member", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        status?: Status.Active;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.status).toEqual({ const: "active" });
    expect(schema.required).toBeUndefined();
  });

  it("should handle enum member in array", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        tags: Status.Active[];
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.tags).toEqual({
      type: "array",
      items: { const: "active" }
    });
  });

  it("should handle enum member in union", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        value: Status.Active | string;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.value).toEqual({
      anyOf: [
        { const: "active" },
        { type: "string" }
      ]
    });
  });

  it("should handle multiple properties with enum members", () => {
    const source = `
      export enum Status {
        Active = "active",
        Inactive = "inactive"
      }

      export enum Priority {
        High = 1,
        Low = 2
      }

      export interface Foo {
        status: Status.Active;
        priority: Priority.High;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.status).toEqual({ const: "active" });
    expect(schema.properties?.priority).toEqual({ const: 1 });
    expect(schema.required).toEqual(["status", "priority"]);
  });

  it("should handle readonly property with enum member", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        readonly status: Status.Active;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.status).toEqual({ const: "active", readOnly: true });
  });

  it("should preserve JSDoc description with enum member", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        /**
         * The current status
         */
        status: Status.Active;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.status).toEqual({
      const: "active",
      description: "The current status"
    });
  });

  it("should handle discriminated union with enum member", () => {
    const source = `
      export enum QuestionType {
        MultipleChoice = "multiple-choice",
        TrueFalse = "true-false"
      }

      export interface MultipleChoiceQuestion {
        id: string;
        type: QuestionType.MultipleChoice;
        options: string[];
      }
    `;

    const schema = toJsonSchema(source, { rootType: "MultipleChoiceQuestion" });
    expect(schema.properties?.type).toEqual({ const: "multiple-choice" });
    expect(schema.properties?.id).toEqual({ type: "string" });
    expect(schema.properties?.options).toEqual({
      type: "array",
      items: { type: "string" }
    });
  });

  it("should fall back to $ref for unknown enum", () => {
    const source = `
      export interface Foo {
        value: UnknownEnum.Member;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.value).toEqual({ $ref: "#/$defs/UnknownEnum" });
  });

  it("should fall back to $ref for unknown member in valid enum", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        value: Status.InvalidMember;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.value).toEqual({ $ref: "#/$defs/Status" });
  });

  it("should handle auto-incrementing numeric enum member", () => {
    const source = `
      export enum Direction {
        Up,
        Down,
        Left,
        Right
      }

      export interface Foo {
        direction: Direction.Down;
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.direction).toEqual({ const: 1 });
  });

  it("should handle enum member in nested object", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        metadata: {
          status: Status.Active;
        };
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.metadata).toEqual({
      type: "object",
      properties: {
        status: { const: "active" }
      },
      required: ["status"]
    });
  });

  it("should handle enum member in tuple", () => {
    const source = `
      export enum Status {
        Active = "active"
      }

      export interface Foo {
        tuple: [Status.Active, number];
      }
    `;

    const schema = toJsonSchema(source, { rootType: "Foo" });
    expect(schema.properties?.tuple).toEqual({
      type: "array",
      prefixItems: [
        { const: "active" },
        { type: "number" }
      ],
      minItems: 2,
      maxItems: 2
    });
  });
});
