/**
 * Tests for import statement parsing
 */

import { describe, it, expect } from "@jest/globals";
import { tokenize } from "../../src/tokenizer.js";
import { extractImports } from "../../src/import-parser.js";

describe("extractImports", () => {
  it("should extract named imports", () => {
    const source = `import { Pet, Dog } from './pet';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0]).toEqual({
      importedNames: ["Pet", "Dog"],
      modulePath: "./pet",
      isDefault: false,
      isNamespace: false,
      namespaceAlias: undefined,
    });
  });

  it("should extract single named import", () => {
    const source = `import { User } from './user';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0]).toEqual({
      importedNames: ["User"],
      modulePath: "./user",
      isDefault: false,
      isNamespace: false,
      namespaceAlias: undefined,
    });
  });

  it("should extract default import", () => {
    const source = `import Pet from './pet';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0]).toEqual({
      importedNames: ["Pet"],
      modulePath: "./pet",
      isDefault: true,
      isNamespace: false,
      namespaceAlias: undefined,
    });
  });

  it("should extract namespace import", () => {
    const source = `import * as Types from './types';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0]).toEqual({
      importedNames: ["*"],
      modulePath: "./types",
      isDefault: false,
      isNamespace: true,
      namespaceAlias: "Types",
    });
  });

  it("should extract imports with aliases", () => {
    const source = `import { Pet as Animal, Dog as Puppy } from './pet';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    // Should keep original names (Pet, Dog), not aliases
    expect(imports[0].importedNames).toEqual(["Pet", "Dog"]);
    expect(imports[0].modulePath).toBe("./pet");
  });

  it("should extract multiple import statements", () => {
    const source = `
      import { Pet } from './pet';
      import { User } from './user';
      import { Config } from './config';
    `;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(3);
    expect(imports[0].modulePath).toBe("./pet");
    expect(imports[1].modulePath).toBe("./user");
    expect(imports[2].modulePath).toBe("./config");
  });

  it("should handle imports with trailing semicolons", () => {
    const source = `import { Pet } from './pet';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("./pet");
  });

  it("should handle imports without semicolons", () => {
    const source = `import { Pet } from './pet'`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("./pet");
  });

  it("should handle imports with newlines", () => {
    const source = `
      import {
        Pet,
        Dog,
        Cat
      } from './animals';
    `;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0].importedNames).toEqual(["Pet", "Dog", "Cat"]);
  });

  it("should skip non-import tokens", () => {
    const source = `
      interface User { name: string; }
      import { Pet } from './pet';
      type Config = { port: number; };
    `;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("./pet");
  });

  it("should handle imports from node_modules", () => {
    const source = `import { EventEmitter } from 'events';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("events");
  });

  it("should handle imports with trailing comma", () => {
    const source = `import { Pet, Dog, } from './pet';`;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(1);
    expect(imports[0].importedNames).toEqual(["Pet", "Dog"]);
  });

  it("should return empty array when no imports", () => {
    const source = `
      interface User { name: string; }
      type Config = { port: number; };
    `;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);

    expect(imports).toHaveLength(0);
  });
});
