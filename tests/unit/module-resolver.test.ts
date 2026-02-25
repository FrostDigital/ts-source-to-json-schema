/**
 * Tests for module resolution
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ModuleResolver } from "../../src/module-resolver.js";

describe("ModuleResolver", () => {
  let tempDir: string;

  beforeAll(() => {
    // Create temporary directory with test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "module-resolver-test-"));
  });

  afterAll(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should resolve single file without imports", () => {
    const filePath = path.join(tempDir, "single.ts");
    fs.writeFileSync(filePath, `
      export interface User {
        name: string;
        age: number;
      }
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    const declarations = resolver.resolveFromEntry(filePath);

    expect(declarations).toHaveLength(1);
    expect(declarations[0].name).toBe("User");
    expect(declarations[0].kind).toBe("interface");
  });

  it("should resolve file with local import", () => {
    // Create pet.ts
    const petPath = path.join(tempDir, "pet.ts");
    fs.writeFileSync(petPath, `
      export interface Pet {
        _id: string;
        name: string;
        species: string;
      }
    `);

    // Create api.ts that imports pet.ts
    const apiPath = path.join(tempDir, "api.ts");
    fs.writeFileSync(apiPath, `
      import { Pet } from './pet';
      export interface PostPetReq extends Omit<Pet, "_id"> {}
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    const declarations = resolver.resolveFromEntry(apiPath);

    expect(declarations).toHaveLength(2);
    const names = declarations.map(d => d.name).sort();
    expect(names).toEqual(["Pet", "PostPetReq"]);
  });

  it("should handle circular dependencies", () => {
    // Create a.ts
    const aPath = path.join(tempDir, "circular-a.ts");
    fs.writeFileSync(aPath, `
      import { B } from './circular-b';
      export interface A {
        b: B;
      }
    `);

    // Create b.ts that imports a.ts (circular)
    const bPath = path.join(tempDir, "circular-b.ts");
    fs.writeFileSync(bPath, `
      import { A } from './circular-a';
      export interface B {
        a: A;
      }
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    // Should not throw or infinite loop
    const declarations = resolver.resolveFromEntry(aPath);

    expect(declarations).toHaveLength(2);
    const names = declarations.map(d => d.name).sort();
    expect(names).toEqual(["A", "B"]);
  });

  it("should detect name collisions", () => {
    // Create user1.ts
    const user1Path = path.join(tempDir, "user1.ts");
    fs.writeFileSync(user1Path, `
      export interface User {
        name: string;
      }
    `);

    // Create user2.ts with same type name
    const user2Path = path.join(tempDir, "user2.ts");
    fs.writeFileSync(user2Path, `
      export interface User {
        email: string;
      }
    `);

    // Create index.ts that imports both
    const indexPath = path.join(tempDir, "collision-index.ts");
    fs.writeFileSync(indexPath, `
      import { User as User1 } from './user1';
      import { User as User2 } from './user2';
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    // Should throw error about duplicate declaration
    expect(() => {
      resolver.resolveFromEntry(indexPath);
    }).toThrow(/Duplicate declaration "User"/);
  });

  it("should skip non-local imports in 'local' mode", () => {
    const filePath = path.join(tempDir, "with-node-import.ts");
    fs.writeFileSync(filePath, `
      import { EventEmitter } from 'events';
      export interface MyEmitter extends EventEmitter {
        customProp: string;
      }
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    const declarations = resolver.resolveFromEntry(filePath);

    // Should only have MyEmitter, not EventEmitter
    expect(declarations).toHaveLength(1);
    expect(declarations[0].name).toBe("MyEmitter");
  });

  it("should resolve multiple levels of imports", () => {
    // Create base.ts
    const basePath = path.join(tempDir, "base.ts");
    fs.writeFileSync(basePath, `
      export interface Base {
        id: string;
      }
    `);

    // Create middle.ts that imports base
    const middlePath = path.join(tempDir, "middle.ts");
    fs.writeFileSync(middlePath, `
      import { Base } from './base';
      export interface Middle extends Base {
        name: string;
      }
    `);

    // Create top.ts that imports middle
    const topPath = path.join(tempDir, "top.ts");
    fs.writeFileSync(topPath, `
      import { Middle } from './middle';
      export interface Top extends Middle {
        extra: boolean;
      }
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    const declarations = resolver.resolveFromEntry(topPath);

    expect(declarations).toHaveLength(3);
    const names = declarations.map(d => d.name).sort();
    expect(names).toEqual(["Base", "Middle", "Top"]);
  });

  it("should throw error for missing file", () => {
    const filePath = path.join(tempDir, "missing-import.ts");
    fs.writeFileSync(filePath, `
      import { Missing } from './does-not-exist';
      export interface Test {}
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    expect(() => {
      resolver.resolveFromEntry(filePath);
    }).toThrow(/Cannot resolve module/);
  });

  it("should resolve imports with .ts extension", () => {
    const basePath = path.join(tempDir, "with-ext-base.ts");
    fs.writeFileSync(basePath, `
      export interface Base {
        id: string;
      }
    `);

    const importerPath = path.join(tempDir, "with-ext-importer.ts");
    fs.writeFileSync(importerPath, `
      import { Base } from './with-ext-base.ts';
      export interface Derived extends Base {}
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    const declarations = resolver.resolveFromEntry(importerPath);

    expect(declarations).toHaveLength(2);
    const names = declarations.map(d => d.name).sort();
    expect(names).toEqual(["Base", "Derived"]);
  });

  it("should skip imports in 'none' mode", () => {
    const basePath = path.join(tempDir, "none-base.ts");
    fs.writeFileSync(basePath, `
      export interface Base {
        id: string;
      }
    `);

    const importerPath = path.join(tempDir, "none-importer.ts");
    fs.writeFileSync(importerPath, `
      import { Base } from './none-base';
      export interface Derived extends Base {}
    `);

    const resolver = new ModuleResolver({
      followImports: "none",
      baseDir: tempDir,
    });

    const declarations = resolver.resolveFromEntry(importerPath);

    // Should only have Derived, not Base
    expect(declarations).toHaveLength(1);
    expect(declarations[0].name).toBe("Derived");
  });

  it("should expose resolved modules", () => {
    const filePath = path.join(tempDir, "modules-test.ts");
    fs.writeFileSync(filePath, `
      export interface Test {
        value: string;
      }
    `);

    const resolver = new ModuleResolver({
      followImports: "local",
      baseDir: tempDir,
    });

    resolver.resolveFromEntry(filePath);
    const modules = resolver.getModules();

    expect(modules.size).toBe(1);
    const module = Array.from(modules.values())[0];
    expect(module.filePath).toContain("modules-test.ts");
    expect(module.declarations).toHaveLength(1);
    expect(module.imports).toHaveLength(0);
  });
});
