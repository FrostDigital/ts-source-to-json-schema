import { tokenize, extractImports, parseDeclarations } from "../../src/index.js";

describe("re-export support", () => {
  describe("import-parser re-export extraction", () => {
    it("should extract export { X } from 'path'", () => {
      const tokens = tokenize(`export { Foo } from "./foo";`);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(1);
      expect(imports[0].modulePath).toBe("./foo");
      expect(imports[0].importedNames).toEqual(["Foo"]);
    });

    it("should extract export type { X } from 'path'", () => {
      const tokens = tokenize(`export type { Foo } from "./foo";`);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(1);
      expect(imports[0].modulePath).toBe("./foo");
      expect(imports[0].importedNames).toEqual(["Foo"]);
    });

    it("should extract export * from 'path'", () => {
      const tokens = tokenize(`export * from "./foo";`);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(1);
      expect(imports[0].modulePath).toBe("./foo");
      expect(imports[0].importedNames).toEqual(["*"]);
      expect(imports[0].isNamespace).toBe(true);
    });

    it("should extract multiple re-exports", () => {
      const source = `
        export { Foo } from "./foo";
        export type { Bar } from "./bar";
        export * from "./baz";
      `;
      const tokens = tokenize(source);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(3);
      expect(imports[0].modulePath).toBe("./foo");
      expect(imports[1].modulePath).toBe("./bar");
      expect(imports[2].modulePath).toBe("./baz");
    });

    it("should extract re-exports with aliases", () => {
      const tokens = tokenize(`export { Foo as Bar } from "./foo";`);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(1);
      expect(imports[0].importedNames).toEqual(["Foo"]);
    });

    it("should extract re-exports alongside regular imports", () => {
      const source = `
        import { A } from "./a";
        export { B } from "./b";
        export * from "./c";
      `;
      const tokens = tokenize(source);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(3);
      expect(imports.map(i => i.modulePath)).toEqual(["./a", "./b", "./c"]);
    });

    it("should not treat export without from as re-export", () => {
      const source = `
        export interface Foo { name: string; }
      `;
      const tokens = tokenize(source);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(0);
    });

    it("should extract re-exports from package specifiers", () => {
      const tokens = tokenize(`export { BaseEntity } from "simple-types";`);
      const imports = extractImports(tokens);
      expect(imports).toHaveLength(1);
      expect(imports[0].modulePath).toBe("simple-types");
    });
  });

  describe("parser re-export handling", () => {
    it("should skip re-exports and not try to parse them as declarations", () => {
      const source = `
        export { Foo } from "./foo";
        export type { Bar } from "./bar";
        export * from "./baz";

        export interface MyType {
          name: string;
        }
      `;
      const decls = parseDeclarations(source);
      expect(decls).toHaveLength(1);
      expect(decls[0].name).toBe("MyType");
    });

    it("should handle re-exports mixed with declare statements", () => {
      const source = `
        export { BaseEntity } from "simple-types";
        export type { FlinkContext } from "@flink-app/types";
        export * from "./local-types";

        export interface LocalType {
          value: string;
          flag: boolean;
        }
      `;
      const decls = parseDeclarations(source);
      expect(decls).toHaveLength(1);
      expect(decls[0].name).toBe("LocalType");
    });
  });
});
