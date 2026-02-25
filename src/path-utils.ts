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

  // In "all" mode, skip node_modules for now (MVP handles local only)
  // This can be enhanced in Phase 2
  if (followMode === "all" && !isRelativeImport(importPath)) {
    return null; // For now, treat "all" same as "local"
  }

  // Resolve relative to the directory of the importing file
  const fromDir = path.dirname(fromFilePath);
  const resolved = path.resolve(fromDir, importPath);

  return resolved;
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
