import * as path from "path";
import { fileURLToPath } from "url";
import { toJsonSchemaFromFile, toJsonSchemasFromFile } from "../../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("followImports: 'all' integration", () => {
  describe("scoped package imports (@flink-app/types)", () => {
    it("should resolve types from scoped package", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-flink-types.ts"),
        { followImports: "all", rootType: "MyHandler", onDuplicateDeclarations: "silent" }
      );
      expect(schema.type).toBe("object");
      expect(schema.properties).toHaveProperty("data");
      expect(schema.properties).toHaveProperty("context");
      expect(schema.properties).toHaveProperty("status");
      // FlinkContext should be in $defs since it's referenced
      expect(schema.$defs).toHaveProperty("FlinkContext");
    });

    it("should fully resolve FlinkContext properties", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-flink-types.ts"),
        { followImports: "all", rootType: "MyHandler", onDuplicateDeclarations: "silent" }
      );
      const context = schema.$defs?.FlinkContext as any;
      expect(context.type).toBe("object");
      expect(context.properties).toHaveProperty("requestId");
      expect(context.properties.requestId.type).toBe("string");
    });
  });

  describe("simple package imports", () => {
    it("should resolve types from simple package and support extends", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-simple-types.ts"),
        { followImports: "all", rootType: "User", onDuplicateDeclarations: "silent" }
      );
      // User extends BaseEntity produces allOf
      expect(schema.allOf).toBeDefined();
      expect(schema.allOf).toHaveLength(2);
      // BaseEntity should be referenced
      expect(schema.$defs).toHaveProperty("BaseEntity");
    });
  });

  describe("deep imports (sub-path)", () => {
    it("should resolve deep imports via exports map", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-deep-import.ts"),
        { followImports: "all", rootType: "MyConfig", onDuplicateDeclarations: "silent" }
      );
      expect(schema.type).toBe("object");
      expect(schema.properties).toHaveProperty("enabled");
      expect(schema.properties).toHaveProperty("util");
      expect(schema.$defs).toHaveProperty("DeepUtil");
    });
  });

  describe("complex .d.ts files", () => {
    it("should parse .d.ts with declare statements and skip unsupported constructs", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-complex-dts.ts"),
        { followImports: "all", rootType: "ServerSetup", onDuplicateDeclarations: "silent" }
      );
      expect(schema.type).toBe("object");
      expect(schema.properties).toHaveProperty("name");
      expect(schema.properties).toHaveProperty("config");
      expect(schema.properties).toHaveProperty("env");
      expect(schema.$defs).toHaveProperty("AppConfig");
    });
  });

  describe("re-exports in packages", () => {
    it("should follow re-exports to resolve types from other packages", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-reexporter.ts"),
        { followImports: "all", rootType: "MyData", onDuplicateDeclarations: "silent" }
      );
      expect(schema.type).toBe("object");
      expect(schema.properties).toHaveProperty("label");
      expect(schema.properties).toHaveProperty("local");
      expect(schema.$defs).toHaveProperty("LocalType");
    });
  });

  describe("graceful degradation", () => {
    it("should not throw for unresolvable external packages", () => {
      const schema = toJsonSchemaFromFile(
        path.join(FIXTURES, "src", "uses-unresolvable.ts"),
        { followImports: "all", rootType: "MySchema" }
      );
      expect(schema.type).toBe("object");
      expect(schema.properties).toHaveProperty("name");
      // UnknownType can't be resolved, so it stays as $ref
      expect(schema.properties).toHaveProperty("data");
    });
  });

  describe("batch generation with followImports: all", () => {
    it("should generate batch schemas for all types from external packages", () => {
      const schemas = toJsonSchemasFromFile(
        path.join(FIXTURES, "src", "uses-flink-types.ts"),
        { followImports: "all", onDuplicateDeclarations: "silent" }
      );
      // Should include types from both entry file and imported packages
      expect(schemas).toHaveProperty("MyHandler");
      expect(schemas).toHaveProperty("FlinkContext");
      expect(schemas).toHaveProperty("PaginatedResponse");
    });
  });
});
