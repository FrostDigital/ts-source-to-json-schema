// ============================================================================
// Module Resolver - Recursively resolves imports across multiple files
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { tokenize } from "./tokenizer.js";
import { Parser } from "./parser.js";
import { extractImports, type ImportStatement } from "./import-parser.js";
import { resolveImportPath, resolveExtensions } from "./path-utils.js";
import type { Declaration } from "./ast.js";

export interface ResolvedModule {
  filePath: string;
  source: string;
  declarations: Declaration[];
  imports: ImportStatement[];
}

export class ModuleResolver {
  private visited = new Set<string>();  // Normalized absolute paths
  private modules = new Map<string, ResolvedModule>();

  constructor(private options: {
    followImports: "none" | "local" | "all";
    baseDir: string;
    onDuplicateDeclarations?: "error" | "warn" | "silent";
  }) {}

  /**
   * Recursively resolve and parse all modules starting from entry file.
   * Returns merged declarations from all files.
   */
  resolveFromEntry(entryPath: string): Declaration[] {
    const normalizedEntry = path.resolve(entryPath);
    this.resolveModule(normalizedEntry);
    return this.mergeDeclarations();
  }

  /**
   * Get all resolved modules (for inspection/debugging)
   */
  getModules(): Map<string, ResolvedModule> {
    return this.modules;
  }

  private resolveModule(filePath: string): void {
    // 1. Check if already visited (circular dependency protection)
    if (this.visited.has(filePath)) {
      return;
    }
    this.visited.add(filePath);

    // 2. Resolve file with extensions
    const resolvedPath = resolveExtensions(filePath);
    if (!resolvedPath) {
      throw new Error(`Cannot resolve module: ${filePath}`);
    }

    // 3. Read and parse file
    let source: string;
    try {
      source = fs.readFileSync(resolvedPath, "utf-8");
    } catch (err) {
      throw new Error(`Failed to read file ${resolvedPath}: ${err instanceof Error ? err.message : String(err)}`);
    }

    let tokens;
    let imports: ImportStatement[];
    let declarations: Declaration[];

    try {
      tokens = tokenize(source);
      imports = extractImports(tokens);
      const parser = new Parser(tokens);
      declarations = parser.parse();
    } catch (err) {
      throw new Error(
        `Parse error in ${resolvedPath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // 4. Store module
    this.modules.set(resolvedPath, {
      filePath: resolvedPath,
      source,
      declarations,
      imports,
    });

    // 5. Recursively resolve imports
    for (const imp of imports) {
      const resolved = resolveImportPath(
        imp.modulePath,
        resolvedPath,
        this.options.followImports
      );
      if (resolved) {
        this.resolveModule(resolved);
      }
    }
  }

  private mergeDeclarations(): Declaration[] {
    const allDeclarations: Declaration[] = [];
    const nameMap = new Map<string, string>();  // name → filePath
    const duplicateMode = this.options.onDuplicateDeclarations ?? "error";

    for (const [filePath, module] of this.modules) {
      for (const decl of module.declarations) {
        // Detect name collisions
        const existing = nameMap.get(decl.name);
        if (existing && existing !== filePath) {
          const errorMsg = `Duplicate declaration "${decl.name}" found in:\n  ${existing}\n  ${filePath}`;

          if (duplicateMode === "error") {
            throw new Error(errorMsg);
          } else if (duplicateMode === "warn") {
            console.warn(`[ts-source-to-json-schema] Warning: ${errorMsg}\nUsing first declaration from: ${existing}`);
          }
          // For both 'warn' and 'silent', skip the duplicate (keep first)
          continue;
        }
        nameMap.set(decl.name, filePath);
        allDeclarations.push(decl);
      }
    }

    return allDeclarations;
  }
}
