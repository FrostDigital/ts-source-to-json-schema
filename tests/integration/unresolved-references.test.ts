import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { toJsonSchema, toJsonSchemas } from "../../src/index.js";

describe("onUnresolvedReferences option", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("default behavior (ignore)", () => {
    it("should emit dangling $refs without throwing", () => {
      const schema = toJsonSchema(
        `interface Order { customer: Customer; total: number }`,
        { includeSchema: false, rootType: "Order" }
      );
      expect(schema.properties?.customer).toEqual({ $ref: "#/$defs/Customer" });
    });
  });

  describe("error mode", () => {
    it("should throw and name the unresolved type", () => {
      expect(() =>
        toJsonSchema(
          `interface Order { customer: Customer; total: number }`,
          { rootType: "Order", onUnresolvedReferences: "error" }
        )
      ).toThrow(/Customer/);
    });

    it("should list all unresolved types", () => {
      expect(() =>
        toJsonSchema(
          `interface Order { customer: Customer; items: LineItem[] }`,
          { rootType: "Order", onUnresolvedReferences: "error" }
        )
      ).toThrow(/Customer.*LineItem|LineItem.*Customer/);
    });

    it("should not throw when all references resolve", () => {
      const schema = toJsonSchema(
        `
          interface Customer { name: string }
          interface Order { customer: Customer }
        `,
        { includeSchema: false, rootType: "Order", onUnresolvedReferences: "error" }
      );
      expect(schema.properties?.customer).toEqual({ $ref: "#/$defs/Customer" });
    });

    it("should not throw for recursive root types", () => {
      const schema = toJsonSchema(
        `
          interface TreeNode {
            value: string;
            children: TreeNode[];
          }
        `,
        { includeSchema: false, rootType: "TreeNode", onUnresolvedReferences: "error" }
      );
      expect(schema.$ref).toBe("#/$defs/TreeNode");
    });

    it("should not throw without a rootType when all references resolve", () => {
      expect(() =>
        toJsonSchema(
          `
            interface A { b: B }
            interface B { name: string }
          `,
          { onUnresolvedReferences: "error" }
        )
      ).not.toThrow();
    });
  });

  describe("warn mode", () => {
    it("should warn and still return the schema", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const schema = toJsonSchema(
        `interface Order { customer: Customer }`,
        { includeSchema: false, rootType: "Order", onUnresolvedReferences: "warn" }
      );
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/Customer/);
      expect(schema.properties?.customer).toEqual({ $ref: "#/$defs/Customer" });
    });

    it("should not warn when all references resolve", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      toJsonSchema(
        `
          interface Customer { name: string }
          interface Order { customer: Customer }
        `,
        { rootType: "Order", onUnresolvedReferences: "warn" }
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("batch generation (toJsonSchemas)", () => {
    it("should throw in error mode and name the schema containing the dangling ref", () => {
      expect(() =>
        toJsonSchemas(
          `export interface Order { customer: Customer }`,
          { onUnresolvedReferences: "error" }
        )
      ).toThrow(/Order.*Customer|Customer.*Order/);
    });

    it("should not throw in error mode when all references resolve", () => {
      const schemas = toJsonSchemas(
        `
          export interface Customer { name: string }
          export interface Order { customer: Customer }
        `,
        { onUnresolvedReferences: "error" }
      );
      expect(Object.keys(schemas).sort()).toEqual(["Customer", "Order"]);
    });

    it("should emit dangling refs silently by default", () => {
      const schemas = toJsonSchemas(
        `export interface Order { customer: Customer }`
      );
      expect(schemas.Order.properties?.customer).toEqual({
        $ref: "#/definitions/Customer",
      });
    });
  });
});
