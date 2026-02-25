/**
 * Integration tests for --followImports functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { toJsonSchemaFromFile } from "../../src/index.js";

describe("toJsonSchemaFromFile with followImports", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "follow-imports-test-"));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve Pet/API example from plan", () => {
    // Create pet.ts
    const petPath = path.join(tempDir, "pet.ts");
    fs.writeFileSync(petPath, `
      export interface Pet {
        _id: string;
        name: string;
        species: string;
      }
    `);

    // Create api.ts
    const apiPath = path.join(tempDir, "api.ts");
    fs.writeFileSync(apiPath, `
      import { Pet } from './pet';
      export interface PostPetReq extends Omit<Pet, "_id"> {}
    `);

    const schema = toJsonSchemaFromFile(apiPath, {
      followImports: "local",
      rootType: "PostPetReq",
    });

    // Should have PostPetReq as root
    expect(schema.type).toBe("object");
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.name).toEqual({ type: "string" });
    expect(schema.properties!.species).toEqual({ type: "string" });
    expect(schema.properties!._id).toBeUndefined(); // Omitted

    // Should have Pet in $defs (PostPetReq is the root, so it's not in $defs)
    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.Pet).toBeDefined();
  });

  it("should work with multiple import levels", () => {
    // Create entity.ts
    const entityPath = path.join(tempDir, "entity.ts");
    fs.writeFileSync(entityPath, `
      export interface Entity {
        id: string;
        createdAt: string;
      }
    `);

    // Create user.ts
    const userPath = path.join(tempDir, "user.ts");
    fs.writeFileSync(userPath, `
      import { Entity } from './entity';
      export interface User extends Entity {
        name: string;
        email: string;
      }
    `);

    // Create api-user.ts
    const apiUserPath = path.join(tempDir, "api-user.ts");
    fs.writeFileSync(apiUserPath, `
      import { User } from './user';
      export interface CreateUserReq extends Omit<User, "id" | "createdAt"> {}
    `);

    const schema = toJsonSchemaFromFile(apiUserPath, {
      followImports: "local",
      rootType: "CreateUserReq",
    });

    // Should have CreateUserReq as root with only name and email
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.name).toEqual({ type: "string" });
    expect(schema.properties!.email).toEqual({ type: "string" });
    expect(schema.properties!.id).toBeUndefined();
    expect(schema.properties!.createdAt).toBeUndefined();

    // Should have Entity and User in $defs (CreateUserReq is the root)
    expect(schema.$defs!.Entity).toBeDefined();
    expect(schema.$defs!.User).toBeDefined();
  });

  it("should handle circular dependencies gracefully", () => {
    // Create node.ts
    const nodePath = path.join(tempDir, "node.ts");
    fs.writeFileSync(nodePath, `
      import { Edge } from './edge';
      export interface Node {
        id: string;
        edges: Edge[];
      }
    `);

    // Create edge.ts
    const edgePath = path.join(tempDir, "edge.ts");
    fs.writeFileSync(edgePath, `
      import { Node } from './node';
      export interface Edge {
        from: Node;
        to: Node;
      }
    `);

    // Should not throw or hang
    const schema = toJsonSchemaFromFile(nodePath, {
      followImports: "local",
    });

    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.Node).toBeDefined();
    expect(schema.$defs!.Edge).toBeDefined();
  });

  it("should skip node_modules in 'local' mode", () => {
    const filePath = path.join(tempDir, "skip-node-modules.ts");
    fs.writeFileSync(filePath, `
      import { EventEmitter } from 'events';
      export interface MyType {
        value: string;
      }
    `);

    const schema = toJsonSchemaFromFile(filePath, {
      followImports: "local",
    });

    // Should only have MyType, not EventEmitter
    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.MyType).toBeDefined();
    expect(schema.$defs!.EventEmitter).toBeUndefined();
  });

  it("should not follow imports in 'none' mode", () => {
    // Create base-none.ts
    const basePath = path.join(tempDir, "base-none.ts");
    fs.writeFileSync(basePath, `
      export interface Base {
        id: string;
      }
    `);

    // Create derived-none.ts
    const derivedPath = path.join(tempDir, "derived-none.ts");
    fs.writeFileSync(derivedPath, `
      import { Base } from './base-none';
      export interface Derived extends Base {
        name: string;
      }
    `);

    const schema = toJsonSchemaFromFile(derivedPath, {
      followImports: "none",
    });

    // Should only have Derived, not Base
    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.Derived).toBeDefined();
    expect(schema.$defs!.Base).toBeUndefined();
  });

  it("should work with complex utility types across files", () => {
    // Create base-complex.ts
    const basePath = path.join(tempDir, "base-complex.ts");
    fs.writeFileSync(basePath, `
      export interface Product {
        id: string;
        name: string;
        price: number;
        description: string;
        stock: number;
      }
    `);

    // Create api-complex.ts
    const apiPath = path.join(tempDir, "api-complex.ts");
    fs.writeFileSync(apiPath, `
      import { Product } from './base-complex';
      export interface CreateProductReq extends Omit<Product, "id"> {}
      export interface UpdateProductReq extends Partial<Omit<Product, "id">> {}
      export interface ProductSummary extends Pick<Product, "id" | "name" | "price"> {}
    `);

    const schema = toJsonSchemaFromFile(apiPath, {
      followImports: "local",
    });

    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.Product).toBeDefined();
    expect(schema.$defs!.CreateProductReq).toBeDefined();
    expect(schema.$defs!.UpdateProductReq).toBeDefined();
    expect(schema.$defs!.ProductSummary).toBeDefined();

    // Verify CreateProductReq has all fields except id
    const createReq = schema.$defs!.CreateProductReq;
    expect(createReq.properties).toBeDefined();
    expect(createReq.properties!.name).toBeDefined();
    expect(createReq.properties!.price).toBeDefined();
    expect(createReq.properties!.id).toBeUndefined();

    // Verify ProductSummary has only id, name, price
    const summary = schema.$defs!.ProductSummary;
    expect(summary.properties).toBeDefined();
    expect(Object.keys(summary.properties!)).toEqual(["id", "name", "price"]);
  });

  it("should throw error for missing imports", () => {
    const filePath = path.join(tempDir, "missing-import.ts");
    fs.writeFileSync(filePath, `
      import { Missing } from './does-not-exist';
      export interface Test {}
    `);

    expect(() => {
      toJsonSchemaFromFile(filePath, {
        followImports: "local",
      });
    }).toThrow(/Cannot resolve module/);
  });

  it("should throw error for duplicate type names across files", () => {
    // Create dup1.ts
    const dup1Path = path.join(tempDir, "dup1.ts");
    fs.writeFileSync(dup1Path, `
      export interface Duplicate {
        field1: string;
      }
    `);

    // Create dup2.ts
    const dup2Path = path.join(tempDir, "dup2.ts");
    fs.writeFileSync(dup2Path, `
      export interface Duplicate {
        field2: number;
      }
    `);

    // Create index-dup.ts
    const indexPath = path.join(tempDir, "index-dup.ts");
    fs.writeFileSync(indexPath, `
      import { Duplicate as D1 } from './dup1';
      import { Duplicate as D2 } from './dup2';
      export type Combined = D1 | D2;
    `);

    expect(() => {
      toJsonSchemaFromFile(indexPath, {
        followImports: "local",
      });
    }).toThrow(/Duplicate declaration "Duplicate"/);
  });

  it("should work with interface extends utility types across files", () => {
    // Create animal.ts
    const animalPath = path.join(tempDir, "animal.ts");
    fs.writeFileSync(animalPath, `
      export interface Animal {
        _id: string;
        species: string;
        age: number;
      }
    `);

    // Create pet-extends.ts
    const petPath = path.join(tempDir, "pet-extends.ts");
    fs.writeFileSync(petPath, `
      import { Animal } from './animal';
      export interface Pet extends Omit<Animal, "_id"> {
        name: string;
        owner: string;
      }
    `);

    const schema = toJsonSchemaFromFile(petPath, {
      followImports: "local",
      rootType: "Pet",
    });

    // Pet uses allOf because it extends a utility type
    expect(schema.allOf).toBeDefined();
    expect(schema.allOf).toHaveLength(2);

    // First part should have Omit<Animal, "_id"> properties
    const omittedPart = schema.allOf![0];
    expect(omittedPart.properties).toBeDefined();
    expect(omittedPart.properties!.species).toEqual({ type: "string" });
    expect(omittedPart.properties!.age).toEqual({ type: "number" });
    expect(omittedPart.properties!._id).toBeUndefined();

    // Second part should have Pet's own properties
    const ownPart = schema.allOf![1];
    expect(ownPart.properties).toBeDefined();
    expect(ownPart.properties!.name).toEqual({ type: "string" });
    expect(ownPart.properties!.owner).toEqual({ type: "string" });
  });
});
