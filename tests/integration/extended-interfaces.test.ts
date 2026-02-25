import { toJsonSchemas } from "../../src/index.js";

describe("Extended interfaces in batch generation", () => {
  it("should include parent in definitions when interface only extends", () => {
    const source = `
      export interface Base {
        id: string;
      }

      export interface Child extends Base {}
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.Child).toBeDefined();
    expect(schemas.Child.$ref).toBe("#/definitions/Base");
    expect(schemas.Child.definitions).toBeDefined();
    expect(schemas.Child.definitions.Base).toBeDefined();
    expect(schemas.Child.definitions.Base).toEqual({
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    });
  });

  it("should handle recursive types with extends", () => {
    const source = `
      export interface TreeNode {
        id: string;
        name: string;
        children: TreeNode[];
      }

      export interface GetTree_12_ResSchema extends TreeNode {}
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.GetTree_12_ResSchema).toBeDefined();
    expect(schemas.GetTree_12_ResSchema.$ref).toBe("#/definitions/TreeNode");
    expect(schemas.GetTree_12_ResSchema.definitions).toBeDefined();
    expect(schemas.GetTree_12_ResSchema.definitions.TreeNode).toBeDefined();

    const treeNodeSchema = schemas.GetTree_12_ResSchema.definitions.TreeNode;
    expect(treeNodeSchema.type).toBe("object");
    expect(treeNodeSchema.properties.id).toEqual({ type: "string" });
    expect(treeNodeSchema.properties.name).toEqual({ type: "string" });
    expect(treeNodeSchema.properties.children).toBeDefined();
    expect(treeNodeSchema.required).toEqual(["id", "name", "children"]);
  });

  it("should handle transitive extends", () => {
    const source = `
      export interface A {
        a: string;
      }

      export interface B extends A {
        b: string;
      }

      export interface C extends B {
        c: string;
      }
    `;

    const schemas = toJsonSchemas(source);

    // C's schema should transitively include both B and A
    expect(schemas.C.definitions.B).toBeDefined();
    expect(schemas.C.definitions.A).toBeDefined();
  });

  it("should handle interface with properties and extends", () => {
    const source = `
      export interface Base {
        id: string;
      }

      export interface Child extends Base {
        name: string;
      }
    `;

    const schemas = toJsonSchemas(source);

    // Child extends Base and adds properties, so it should include Base in definitions
    expect(schemas.Child.allOf).toBeDefined();
    expect(schemas.Child.definitions.Base).toBeDefined();
    expect(schemas.Child.definitions.Base).toEqual({
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    });
  });

  it("should handle multiple extends", () => {
    const source = `
      export interface A {
        a: string;
      }

      export interface B {
        b: number;
      }

      export interface C extends A, B {
        c: boolean;
      }
    `;

    const schemas = toJsonSchemas(source);

    // C extends both A and B, so both should be in definitions
    expect(schemas.C.definitions.A).toBeDefined();
    expect(schemas.C.definitions.B).toBeDefined();
  });
});
