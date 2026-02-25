/**
 * Integration tests for toJsonSchemasFromFile with followImports
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { toJsonSchemasFromFile } from "../../src/index.js";

describe("toJsonSchemasFromFile with followImports", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "batch-follow-imports-test-"));
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve Flink's TreeNode use case", () => {
    // Create TreeNode.ts
    const treeNodePath = path.join(tempDir, "TreeNode.ts");
    fs.writeFileSync(treeNodePath, `
      export default interface TreeNode {
        id: string;
        name: string;
        children: TreeNode[];
      }
    `);

    // Create Car.ts
    const carPath = path.join(tempDir, "Car.ts");
    fs.writeFileSync(carPath, `
      export default interface Car {
        _id: string;
        make: string;
        model: string;
        year: number;
      }
    `);

    // Create schemas.ts (Flink's intermediate file)
    const schemasPath = path.join(tempDir, "schemas.ts");
    fs.writeFileSync(schemasPath, `
      import TreeNode from "./TreeNode";
      import Car from "./Car";

      export interface GetTree_12_ResSchema extends TreeNode {}
      export interface GetCar_10_ResSchema extends Car {}
    `);

    const schemas = toJsonSchemasFromFile(schemasPath, {
      followImports: "local",
    });

    // Verify GetTree_12_ResSchema
    expect(schemas.GetTree_12_ResSchema).toBeDefined();
    expect(schemas.GetTree_12_ResSchema.$ref).toBe("#/definitions/TreeNode");
    expect(schemas.GetTree_12_ResSchema.definitions).toBeDefined();
    expect(schemas.GetTree_12_ResSchema.definitions!.TreeNode).toBeDefined();

    // TreeNode should be recursive
    const treeNodeDef = schemas.GetTree_12_ResSchema.definitions!.TreeNode;
    expect(treeNodeDef.properties).toBeDefined();
    expect(treeNodeDef.properties!.id).toEqual({ type: "string" });
    expect(treeNodeDef.properties!.children).toEqual({
      type: "array",
      items: { $ref: "#/definitions/TreeNode" },
    });

    // Verify GetCar_10_ResSchema
    expect(schemas.GetCar_10_ResSchema).toBeDefined();
    expect(schemas.GetCar_10_ResSchema.$ref).toBe("#/definitions/Car");
    expect(schemas.GetCar_10_ResSchema.definitions).toBeDefined();
    expect(schemas.GetCar_10_ResSchema.definitions!.Car).toBeDefined();

    // Car should have all properties
    const carDef = schemas.GetCar_10_ResSchema.definitions!.Car;
    expect(carDef.properties).toBeDefined();
    expect(carDef.properties!._id).toEqual({ type: "string" });
    expect(carDef.properties!.make).toEqual({ type: "string" });
    expect(carDef.properties!.year).toEqual({ type: "number" });
  });

  it("should handle complex multi-level imports", () => {
    // Create Entity.ts
    const entityPath = path.join(tempDir, "Entity.ts");
    fs.writeFileSync(entityPath, `
      export interface Entity {
        id: string;
        createdAt: string;
        updatedAt: string;
      }
    `);

    // Create User.ts
    const userPath = path.join(tempDir, "User.ts");
    fs.writeFileSync(userPath, `
      import { Entity } from "./Entity";
      export interface User extends Entity {
        name: string;
        email: string;
      }
    `);

    // Create Post.ts
    const postPath = path.join(tempDir, "Post.ts");
    fs.writeFileSync(postPath, `
      import { User } from "./User";
      export interface Post {
        id: string;
        title: string;
        content: string;
        author: User;
      }
    `);

    // Create api.ts
    const apiPath = path.join(tempDir, "api.ts");
    fs.writeFileSync(apiPath, `
      import { User } from "./User";
      import { Post } from "./Post";

      export interface CreateUserReq extends Omit<User, "id" | "createdAt" | "updatedAt"> {}
      export interface GetPostRes extends Post {}
    `);

    const schemas = toJsonSchemasFromFile(apiPath, {
      followImports: "local",
    });

    // Verify CreateUserReq
    expect(schemas.CreateUserReq).toBeDefined();
    expect(schemas.CreateUserReq.properties).toBeDefined();
    expect(schemas.CreateUserReq.properties!.name).toEqual({ type: "string" });
    expect(schemas.CreateUserReq.properties!.email).toEqual({ type: "string" });
    expect(schemas.CreateUserReq.properties!.id).toBeUndefined();

    // CreateUserReq should have User and Entity in definitions
    expect(schemas.CreateUserReq.definitions).toBeDefined();
    expect(schemas.CreateUserReq.definitions!.User).toBeDefined();
    expect(schemas.CreateUserReq.definitions!.Entity).toBeDefined();

    // Verify GetPostRes
    expect(schemas.GetPostRes).toBeDefined();
    expect(schemas.GetPostRes.$ref).toBe("#/definitions/Post");
    expect(schemas.GetPostRes.definitions).toBeDefined();
    expect(schemas.GetPostRes.definitions!.Post).toBeDefined();
    expect(schemas.GetPostRes.definitions!.User).toBeDefined();
    expect(schemas.GetPostRes.definitions!.Entity).toBeDefined();
  });

  it("should handle circular dependencies across files", () => {
    // Create NodeType.ts
    const nodeTypePath = path.join(tempDir, "NodeType.ts");
    fs.writeFileSync(nodeTypePath, `
      import { EdgeType } from "./EdgeType";
      export interface NodeType {
        id: string;
        edges: EdgeType[];
      }
    `);

    // Create EdgeType.ts
    const edgeTypePath = path.join(tempDir, "EdgeType.ts");
    fs.writeFileSync(edgeTypePath, `
      import { NodeType } from "./NodeType";
      export interface EdgeType {
        from: NodeType;
        to: NodeType;
      }
    `);

    // Create graph.ts
    const graphPath = path.join(tempDir, "graph.ts");
    fs.writeFileSync(graphPath, `
      import { NodeType } from "./NodeType";
      import { EdgeType } from "./EdgeType";

      export interface Graph {
        nodes: NodeType[];
        edges: EdgeType[];
      }
    `);

    // Should not throw or hang
    const schemas = toJsonSchemasFromFile(graphPath, {
      followImports: "local",
    });

    expect(schemas.Graph).toBeDefined();
    expect(schemas.Graph.definitions).toBeDefined();
    expect(schemas.Graph.definitions!.NodeType).toBeDefined();
    expect(schemas.Graph.definitions!.EdgeType).toBeDefined();
  });

  it("should work without followImports (backward compatible)", () => {
    // Create standalone.ts
    const standalonePath = path.join(tempDir, "standalone.ts");
    fs.writeFileSync(standalonePath, `
      export interface User {
        id: string;
        name: string;
      }

      export interface Post {
        id: string;
        title: string;
      }
    `);

    const schemas = toJsonSchemasFromFile(standalonePath, {
      followImports: "none",
    });

    expect(schemas.User).toBeDefined();
    expect(schemas.Post).toBeDefined();
    expect(schemas.User.properties).toBeDefined();
    expect(schemas.User.properties!.id).toEqual({ type: "string" });
  });

  it("should include $schema field by default", () => {
    // Create simple.ts
    const simplePath = path.join(tempDir, "simple-schema.ts");
    fs.writeFileSync(simplePath, `
      export interface Simple {
        value: string;
      }
    `);

    const schemas = toJsonSchemasFromFile(simplePath, {
      followImports: "none",
      includeSchema: true,
    });

    expect(schemas.Simple.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it("should respect strictObjects option", () => {
    // Create strict.ts
    const strictPath = path.join(tempDir, "strict.ts");
    fs.writeFileSync(strictPath, `
      export interface User {
        name: string;
      }
    `);

    const schemas = toJsonSchemasFromFile(strictPath, {
      followImports: "none",
      strictObjects: true,
    });

    expect(schemas.User.additionalProperties).toBe(false);
  });

  it("should skip node_modules in 'local' mode", () => {
    const filePath = path.join(tempDir, "skip-modules.ts");
    fs.writeFileSync(filePath, `
      import { EventEmitter } from 'events';
      export interface MyType {
        value: string;
      }
      export interface AnotherType {
        id: number;
      }
    `);

    const schemas = toJsonSchemasFromFile(filePath, {
      followImports: "local",
    });

    // Should have MyType and AnotherType, not EventEmitter
    expect(schemas.MyType).toBeDefined();
    expect(schemas.AnotherType).toBeDefined();
    expect(schemas.EventEmitter).toBeUndefined();
  });

  it("should handle Omit utility type with imports", () => {
    // Create Product.ts
    const productPath = path.join(tempDir, "Product.ts");
    fs.writeFileSync(productPath, `
      export interface Product {
        _id: string;
        name: string;
        price: number;
        description: string;
      }
    `);

    // Create api-product.ts
    const apiPath = path.join(tempDir, "api-product.ts");
    fs.writeFileSync(apiPath, `
      import { Product } from "./Product";

      export interface CreateProductReq extends Omit<Product, "_id"> {}
      export interface UpdateProductReq extends Partial<Omit<Product, "_id">> {}
    `);

    const schemas = toJsonSchemasFromFile(apiPath, {
      followImports: "local",
    });

    // Verify CreateProductReq
    expect(schemas.CreateProductReq).toBeDefined();
    expect(schemas.CreateProductReq.properties).toBeDefined();
    expect(schemas.CreateProductReq.properties!.name).toBeDefined();
    expect(schemas.CreateProductReq.properties!.price).toBeDefined();
    expect(schemas.CreateProductReq.properties!._id).toBeUndefined();

    // Verify UpdateProductReq (Partial<Omit<...>> - all properties should be optional)
    expect(schemas.UpdateProductReq).toBeDefined();
    expect(schemas.UpdateProductReq.properties).toBeDefined();
    expect(schemas.UpdateProductReq.properties!.name).toBeDefined();
    expect(schemas.UpdateProductReq.properties!.price).toBeDefined();
    expect(schemas.UpdateProductReq.properties!._id).toBeUndefined();
  });

  it("should throw error for missing imports", () => {
    const filePath = path.join(tempDir, "missing-batch.ts");
    fs.writeFileSync(filePath, `
      import { Missing } from "./does-not-exist";
      export interface Test {
        value: string;
      }
    `);

    expect(() => {
      toJsonSchemasFromFile(filePath, {
        followImports: "local",
      });
    }).toThrow(/Cannot resolve module/);
  });

  it("should handle Pick utility type with imports", () => {
    // Create FullType.ts
    const fullTypePath = path.join(tempDir, "FullType.ts");
    fs.writeFileSync(fullTypePath, `
      export interface FullType {
        id: string;
        name: string;
        email: string;
        age: number;
        address: string;
      }
    `);

    // Create summaries.ts
    const summariesPath = path.join(tempDir, "summaries.ts");
    fs.writeFileSync(summariesPath, `
      import { FullType } from "./FullType";

      export interface Summary extends Pick<FullType, "id" | "name"> {}
      export interface DetailedSummary extends Pick<FullType, "id" | "name" | "email"> {}
    `);

    const schemas = toJsonSchemasFromFile(summariesPath, {
      followImports: "local",
    });

    // Verify Summary
    expect(schemas.Summary).toBeDefined();
    expect(schemas.Summary.properties).toBeDefined();
    expect(Object.keys(schemas.Summary.properties!)).toEqual(["id", "name"]);

    // Verify DetailedSummary
    expect(schemas.DetailedSummary).toBeDefined();
    expect(schemas.DetailedSummary.properties).toBeDefined();
    expect(Object.keys(schemas.DetailedSummary.properties!)).toEqual(["id", "name", "email"]);
  });
});
