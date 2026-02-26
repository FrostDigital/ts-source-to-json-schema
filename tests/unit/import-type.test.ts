import { tokenize, extractImports } from "../../src/index.js";

describe("import type support in import-parser", () => {
  it("should extract import type { X } from 'path'", () => {
    const tokens = tokenize(`import type { Foo } from "./foo";`);
    const imports = extractImports(tokens);
    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("./foo");
    expect(imports[0].importedNames).toEqual(["Foo"]);
  });

  it("should extract import type X from 'path'", () => {
    const tokens = tokenize(`import type Foo from "./foo";`);
    const imports = extractImports(tokens);
    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("./foo");
    expect(imports[0].importedNames).toEqual(["Foo"]);
    expect(imports[0].isDefault).toBe(true);
  });

  it("should extract import type * as X from 'path'", () => {
    const tokens = tokenize(`import type * as Types from "./types";`);
    const imports = extractImports(tokens);
    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("./types");
    expect(imports[0].isNamespace).toBe(true);
  });

  it("should extract multiple import type statements", () => {
    const source = `
      import type { Foo } from "./foo";
      import type { Bar, Baz } from "./bar";
      import { Regular } from "./regular";
    `;
    const tokens = tokenize(source);
    const imports = extractImports(tokens);
    expect(imports).toHaveLength(3);
    expect(imports[0].importedNames).toEqual(["Foo"]);
    expect(imports[1].importedNames).toEqual(["Bar", "Baz"]);
    expect(imports[2].importedNames).toEqual(["Regular"]);
  });

  it("should extract import type from package specifiers", () => {
    const tokens = tokenize(`import type { FlinkContext } from "@flink-app/types";`);
    const imports = extractImports(tokens);
    expect(imports).toHaveLength(1);
    expect(imports[0].modulePath).toBe("@flink-app/types");
    expect(imports[0].importedNames).toEqual(["FlinkContext"]);
  });
});
