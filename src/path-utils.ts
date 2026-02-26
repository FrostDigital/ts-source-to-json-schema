// ============================================================================
// Path Utilities - Resolve import paths with TypeScript conventions
// ============================================================================

import * as path from "path";
import * as fs from "fs";

/**
 * Check if path is a relative import (./ or ../)
 */
export function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith("./") || importPath.startsWith("../");
}

/**
 * Resolve import path based on follow mode.
 * Returns absolute path or null if should be skipped.
 */
export function resolveImportPath(
  importPath: string,
  fromFilePath: string,
  followMode: "none" | "local" | "all"
): string | null {
  // Skip all imports in "none" mode
  if (followMode === "none") {
    return null;
  }

  // In "local" mode, only follow relative imports
  if (followMode === "local" && !isRelativeImport(importPath)) {
    return null;
  }

  // Handle relative imports (both "local" and "all" modes)
  if (isRelativeImport(importPath)) {
    const fromDir = path.dirname(fromFilePath);
    return path.resolve(fromDir, importPath);
  }

  // In "all" mode, resolve node_modules packages
  if (followMode === "all") {
    return resolveNodeModule(importPath, fromFilePath);
  }

  return null;
}

/**
 * Resolve a bare/package import by walking up node_modules directories.
 * Handles scoped packages (@scope/pkg) and deep imports (@scope/pkg/sub/path).
 *
 * Resolution strategy:
 * 1. Walk up from importing file looking for node_modules/<package>
 * 2. Read package.json to find type entry point
 * 3. Resolve with TypeScript extensions
 */
export function resolveNodeModule(
  importPath: string,
  fromFilePath: string
): string | null {
  // Split into package name and sub-path
  const { packageName, subPath } = parsePackageImport(importPath);

  // Walk up directory tree looking for node_modules
  let dir = path.dirname(path.resolve(fromFilePath));
  const root = path.parse(dir).root;

  while (dir !== root) {
    const nodeModulesDir = path.join(dir, "node_modules", packageName);

    if (fs.existsSync(nodeModulesDir) && fs.statSync(nodeModulesDir).isDirectory()) {
      // Found the package directory
      if (subPath) {
        // Deep import: @scope/pkg/sub/path → resolve sub/path within package
        return resolveDeepImport(nodeModulesDir, subPath);
      }
      // Root import: resolve via package.json
      return resolvePackageEntry(nodeModulesDir);
    }

    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Parse a package import into package name and optional sub-path.
 * Examples:
 *   "lodash" → { packageName: "lodash", subPath: undefined }
 *   "lodash/fp" → { packageName: "lodash", subPath: "fp" }
 *   "@scope/pkg" → { packageName: "@scope/pkg", subPath: undefined }
 *   "@scope/pkg/utils" → { packageName: "@scope/pkg", subPath: "utils" }
 */
export function parsePackageImport(importPath: string): {
  packageName: string;
  subPath: string | undefined;
} {
  if (importPath.startsWith("@")) {
    // Scoped package: @scope/pkg[/sub/path]
    const parts = importPath.split("/");
    const packageName = parts.slice(0, 2).join("/");
    const subPath = parts.length > 2 ? parts.slice(2).join("/") : undefined;
    return { packageName, subPath };
  }

  // Regular package: pkg[/sub/path]
  const slashIndex = importPath.indexOf("/");
  if (slashIndex === -1) {
    return { packageName: importPath, subPath: undefined };
  }
  return {
    packageName: importPath.substring(0, slashIndex),
    subPath: importPath.substring(slashIndex + 1),
  };
}

/**
 * Resolve the type entry point of a package from its package.json.
 * Checks (in order):
 * 1. "types" or "typings" field
 * 2. "exports["."].types" (conditional exports)
 * 3. "main" field → look for .d.ts alongside
 * 4. Fallback: index.d.ts
 */
export function resolvePackageEntry(packageDir: string): string | null {
  const pkgJsonPath = path.join(packageDir, "package.json");

  if (fs.existsSync(pkgJsonPath)) {
    let pkg: Record<string, any>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    } catch {
      return null;
    }

    // 1. "types" or "typings" field
    const typesField = pkg.types || pkg.typings;
    if (typesField) {
      const resolved = path.resolve(packageDir, typesField);
      if (fs.existsSync(resolved)) return resolved;
    }

    // 2. "exports" field - check for types condition
    const typesFromExports = resolveExportsTypes(pkg.exports, packageDir);
    if (typesFromExports) return typesFromExports;

    // 3. "main" field → look for .d.ts alongside
    if (pkg.main) {
      const mainPath = path.resolve(packageDir, pkg.main);
      const dtsFromMain = findDtsForFile(mainPath);
      if (dtsFromMain) return dtsFromMain;
    }
  }

  // 4. Fallback: index.d.ts or index.ts
  return resolveExtensions(path.join(packageDir, "index"));
}

/**
 * Extract types entry from package.json "exports" field.
 * Handles common patterns:
 *   - exports: { ".": { "types": "./dist/index.d.ts" } }
 *   - exports: { ".": { "import": { "types": "./dist/index.d.mts" } } }
 *   - exports: { "types": "./dist/index.d.ts" }  (shorthand for ".")
 */
function resolveExportsTypes(
  exports: any,
  packageDir: string
): string | null {
  if (!exports || typeof exports !== "object") return null;

  // Direct string (no conditions) - not useful for types
  if (typeof exports === "string") return null;

  // Check for "types" at top level of exports (shorthand)
  if (exports.types && typeof exports.types === "string") {
    const resolved = path.resolve(packageDir, exports.types);
    if (fs.existsSync(resolved)) return resolved;
  }

  // Check exports["."]
  const dotExport = exports["."];
  if (dotExport) {
    const result = resolveConditionTypes(dotExport, packageDir);
    if (result) return result;
  }

  return null;
}

/**
 * Resolve "types" from a conditional export object.
 * Handles nested conditions like { import: { types: "..." }, require: { types: "..." } }
 */
function resolveConditionTypes(
  condition: any,
  packageDir: string
): string | null {
  if (!condition || typeof condition !== "object") return null;

  // Direct "types" condition
  if (condition.types && typeof condition.types === "string") {
    const resolved = path.resolve(packageDir, condition.types);
    if (fs.existsSync(resolved)) return resolved;
  }

  // Check nested: import.types, require.types
  for (const key of ["import", "require", "default"]) {
    if (condition[key] && typeof condition[key] === "object") {
      const nested = condition[key];
      if (nested.types && typeof nested.types === "string") {
        const resolved = path.resolve(packageDir, nested.types);
        if (fs.existsSync(resolved)) return resolved;
      }
    }
  }

  return null;
}

/**
 * Find a .d.ts file corresponding to a .js file.
 * foo.js → foo.d.ts, foo.mjs → foo.d.mts, etc.
 */
function findDtsForFile(filePath: string): string | null {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);

  // Try common .d.ts extensions
  const dtsExts = [".d.ts", ".d.mts", ".d.cts"];
  for (const dtsExt of dtsExts) {
    const dtsPath = base + dtsExt;
    if (fs.existsSync(dtsPath)) return dtsPath;
  }

  return null;
}

/**
 * Resolve a deep import within a package directory.
 * @scope/pkg/utils → node_modules/@scope/pkg/utils with extension resolution
 */
function resolveDeepImport(packageDir: string, subPath: string): string | null {
  const fullPath = path.join(packageDir, subPath);

  // First check package.json exports for sub-path mapping
  const pkgJsonPath = path.join(packageDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      if (pkg.exports) {
        const exportKey = "./" + subPath;
        const exportEntry = pkg.exports[exportKey];
        if (exportEntry) {
          const result = resolveConditionTypes(
            typeof exportEntry === "string" ? { types: exportEntry } : exportEntry,
            packageDir
          );
          if (result) return result;
        }
      }
    } catch {
      // Ignore package.json parse errors
    }
  }

  // Fall back to direct path resolution with extensions
  return resolveExtensions(fullPath);
}

/**
 * Expand a glob pattern to matching file paths.
 * Supports: *, **, and ? wildcards.
 * Returns absolute paths sorted alphabetically.
 */
export function expandGlob(pattern: string): string[] {
  // If no glob chars, return as-is (it's a literal path)
  if (!/[*?]/.test(pattern)) {
    const resolved = path.resolve(pattern);
    return fs.existsSync(resolved) ? [resolved] : [];
  }

  // Split pattern into base dir (no globs) and glob part
  const allParts = pattern.split(/[\\/]/);
  let baseDir = ".";
  let globParts: string[] = [];

  for (let i = 0; i < allParts.length; i++) {
    if (/[*?]/.test(allParts[i])) {
      baseDir = allParts.slice(0, i).join(path.sep) || ".";
      globParts = allParts.slice(i);
      break;
    }
  }

  const resolvedBase = path.resolve(baseDir);
  if (!fs.existsSync(resolvedBase)) return [];

  const results: string[] = [];
  matchRecursive(resolvedBase, globParts, 0, results);
  return results.sort();
}

/**
 * Recursively match path segments against glob parts.
 */
function matchRecursive(
  currentDir: string,
  globParts: string[],
  partIndex: number,
  results: string[]
): void {
  if (partIndex >= globParts.length) return;

  const part = globParts[partIndex];
  const isLast = partIndex === globParts.length - 1;

  if (part === "**") {
    // ** matches zero or more directory levels
    // Try matching zero levels (skip **)
    if (partIndex + 1 < globParts.length) {
      matchRecursive(currentDir, globParts, partIndex + 1, results);
    }

    // Try matching one or more levels
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        // Recurse into subdirectory, keeping ** active
        matchRecursive(fullPath, globParts, partIndex, results);
      } else if (isLast) {
        // ** at end matches files too
        results.push(fullPath);
      }
    }
  } else {
    // Regular segment with possible * or ? wildcards
    const regex = globPartToRegex(part);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (!regex.test(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (isLast) {
        if (entry.isFile()) {
          results.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        matchRecursive(fullPath, globParts, partIndex + 1, results);
      }
    }
  }
}

/**
 * Convert a glob segment (e.g. "*.ts") to a regex.
 */
function globPartToRegex(part: string): RegExp {
  let regex = "^";
  for (const ch of part) {
    if (ch === "*") regex += ".*";
    else if (ch === "?") regex += ".";
    else if (".+^${}()|[]\\".includes(ch)) regex += "\\" + ch;
    else regex += ch;
  }
  regex += "$";
  return new RegExp(regex);
}

/**
 * Try to resolve a module path with TypeScript extensions.
 * Tries in order: exact match, .ts, .tsx, .d.ts, index.ts, index.tsx, index.d.ts
 * Returns absolute path if found, null otherwise.
 */
export function resolveExtensions(basePath: string): string | null {
  // Try exact match first
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath;
  }

  // Try adding extensions
  const extensions = [".ts", ".tsx", ".d.ts"];
  for (const ext of extensions) {
    const withExt = basePath + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  // Try index files (if basePath is a directory or doesn't exist yet)
  const indexFiles = ["index.ts", "index.tsx", "index.d.ts"];
  for (const indexFile of indexFiles) {
    const indexPath = path.join(basePath, indexFile);
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return indexPath;
    }
  }

  return null;
}
