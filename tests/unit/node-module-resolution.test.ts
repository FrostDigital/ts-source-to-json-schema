import * as path from "path";
import { fileURLToPath } from "url";
import {
  parsePackageImport,
  resolveNodeModule,
  resolvePackageEntry,
  resolveImportPath,
} from "../../src/path-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("node_modules resolution", () => {
  describe("parsePackageImport", () => {
    it("should parse simple package name", () => {
      const result = parsePackageImport("lodash");
      expect(result.packageName).toBe("lodash");
      expect(result.subPath).toBeUndefined();
    });

    it("should parse package with sub-path", () => {
      const result = parsePackageImport("lodash/fp");
      expect(result.packageName).toBe("lodash");
      expect(result.subPath).toBe("fp");
    });

    it("should parse scoped package", () => {
      const result = parsePackageImport("@flink-app/types");
      expect(result.packageName).toBe("@flink-app/types");
      expect(result.subPath).toBeUndefined();
    });

    it("should parse scoped package with sub-path", () => {
      const result = parsePackageImport("@flink-app/types/utils");
      expect(result.packageName).toBe("@flink-app/types");
      expect(result.subPath).toBe("utils");
    });

    it("should parse deep sub-path", () => {
      const result = parsePackageImport("@scope/pkg/a/b/c");
      expect(result.packageName).toBe("@scope/pkg");
      expect(result.subPath).toBe("a/b/c");
    });
  });

  describe("resolveNodeModule", () => {
    const fromFile = path.join(FIXTURES, "src", "test.ts");

    it("should resolve scoped package via types field", () => {
      const result = resolveNodeModule("@flink-app/types", fromFile);
      expect(result).toBe(
        path.join(FIXTURES, "node_modules", "@flink-app", "types", "dist", "index.d.ts")
      );
    });

    it("should resolve simple package via types field", () => {
      const result = resolveNodeModule("simple-types", fromFile);
      expect(result).toBe(
        path.join(FIXTURES, "node_modules", "simple-types", "index.d.ts")
      );
    });

    it("should resolve deep import via exports map", () => {
      const result = resolveNodeModule("deep-exports/utils", fromFile);
      expect(result).toBe(
        path.join(FIXTURES, "node_modules", "deep-exports", "utils", "index.d.ts")
      );
    });

    it("should resolve package with conditional exports", () => {
      const result = resolveNodeModule("conditional-exports", fromFile);
      expect(result).toBe(
        path.join(FIXTURES, "node_modules", "conditional-exports", "dist", "index.d.mts")
      );
    });

    it("should return null for nonexistent package", () => {
      const result = resolveNodeModule("nonexistent-package", fromFile);
      expect(result).toBeNull();
    });
  });

  describe("resolvePackageEntry", () => {
    it("should resolve via types field", () => {
      const pkgDir = path.join(FIXTURES, "node_modules", "@flink-app", "types");
      const result = resolvePackageEntry(pkgDir);
      expect(result).toBe(path.join(pkgDir, "dist", "index.d.ts"));
    });

    it("should resolve via exports types", () => {
      const pkgDir = path.join(FIXTURES, "node_modules", "conditional-exports");
      const result = resolvePackageEntry(pkgDir);
      expect(result).toBe(path.join(pkgDir, "dist", "index.d.mts"));
    });

    it("should fall back to index.d.ts", () => {
      const pkgDir = path.join(FIXTURES, "node_modules", "simple-types");
      const result = resolvePackageEntry(pkgDir);
      expect(result).toBe(path.join(pkgDir, "index.d.ts"));
    });
  });

  describe("resolveImportPath with followImports: 'all'", () => {
    const fromFile = path.join(FIXTURES, "src", "test.ts");

    it("should resolve package imports in all mode", () => {
      const result = resolveImportPath("@flink-app/types", fromFile, "all");
      expect(result).not.toBeNull();
      expect(result).toContain("@flink-app");
    });

    it("should still resolve relative imports in all mode", () => {
      const result = resolveImportPath("./other", fromFile, "all");
      expect(result).toBe(path.resolve(path.dirname(fromFile), "./other"));
    });

    it("should skip package imports in local mode", () => {
      const result = resolveImportPath("@flink-app/types", fromFile, "local");
      expect(result).toBeNull();
    });

    it("should skip all imports in none mode", () => {
      const result = resolveImportPath("@flink-app/types", fromFile, "none");
      expect(result).toBeNull();
    });
  });
});
