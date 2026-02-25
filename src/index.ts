// ============================================================================
// ts-to-jsonschema - Zero-dependency TypeScript type → JSON Schema converter
// ============================================================================
//
// This is a custom mini-parser that handles a practical subset of TypeScript's
// type syntax and converts it to JSON Schema (2020-12 draft).
//
// It does NOT use the TypeScript compiler. It tokenizes and parses the source
// string directly, making it fast, portable, and dependency-free.
//
// Supported constructs:
//   - interface declarations (with extends)
//   - type alias declarations
//   - enum declarations (string and numeric)
//   - Primitives: string, number, boolean, null, undefined, any, unknown, etc.
//   - Literal types: "foo", 42, true
//   - Union types: A | B | C
//   - Intersection types: A & B
//   - Array types: T[] and Array<T>
//   - Tuple types: [string, number] (including named and rest elements)
//   - Inline object types: { foo: string; bar: number }
//   - Record<K, V>
//   - Utility types: Partial<T>, Required<T>, Pick<T, K>, Omit<T, K>, Readonly<T>
//   - Nullable: string | null
//   - Index signatures: [key: string]: ValueType
//   - JSDoc comments → description + tags (@minimum, @pattern, @format, etc.)
//   - readonly properties → readOnly in schema
//   - Optional properties → required array handling
//   - Set<T> → array with uniqueItems
//   - Map<K, V> → object with additionalProperties
//   - Promise<T> → unwrapped to T
//
// ============================================================================

export { tokenize } from "./tokenizer.js";
export type { Token, TokenType } from "./tokenizer.js";

export { Parser, ParseError } from "./parser.js";

export { Emitter } from "./emitter.js";
export type { JSONSchema, EmitterOptions } from "./emitter.js";

export type {
  TypeNode, PropertyNode, Declaration,
  InterfaceDeclaration, TypeAliasDeclaration, EnumDeclaration,
} from "./ast.js";

export { ModuleResolver } from "./module-resolver.js";
export type { ResolvedModule } from "./module-resolver.js";

export { extractImports } from "./import-parser.js";
export type { ImportStatement } from "./import-parser.js";

import * as fs from "fs";
import * as path from "path";
import { tokenize } from "./tokenizer.js";
import { Parser } from "./parser.js";
import { Emitter, type JSONSchema, type EmitterOptions } from "./emitter.js";
import { ModuleResolver } from "./module-resolver.js";

/**
 * Convert TypeScript source containing type declarations to JSON Schema.
 *
 * @example
 * ```ts
 * const schema = toJsonSchema(`
 *   interface User {
 *     name: string;
 *     age?: number;
 *     role: "admin" | "user";
 *   }
 * `, { rootType: "User" });
 * ```
 */
export function toJsonSchema(source: string, options?: EmitterOptions): JSONSchema {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  const declarations = parser.parse();
  const emitter = new Emitter(declarations, options);
  return emitter.emit();
}

/**
 * Generates JSON schemas for all top-level type definitions in the source.
 *
 * More efficient than calling toJsonSchema() multiple times when you need
 * multiple schemas from the same source file. Each schema is standalone
 * and includes only the types it references in its `definitions` field.
 *
 * @param source - TypeScript source code
 * @param options - Schema generation options (rootType is ignored)
 * @returns Map of type name to JSON schema
 *
 * @example
 * ```ts
 * const source = `
 *   export interface User { id: string; name: string; }
 *   export interface Post { id: string; title: string; author: User; }
 * `;
 *
 * const schemas = toJsonSchemas(source);
 * // Returns:
 * // {
 * //   "User": { type: "object", properties: {...}, required: [...], definitions: {} },
 * //   "Post": { type: "object", properties: {...}, required: [...], definitions: { User: {...} } }
 * // }
 * ```
 */
export function toJsonSchemas(
  source: string,
  options?: Omit<EmitterOptions, 'rootType'>
): Record<string, JSONSchema> {
  // Tokenize once
  const tokens = tokenize(source);

  // Parse once
  const parser = new Parser(tokens);
  const declarations = parser.parse();

  // Emit all schemas in batch
  const emitter = new Emitter(declarations, options || {});
  return emitter.emitAll();
}

/**
 * Parse TypeScript source and return the AST declarations.
 * Useful for inspection or custom transformations.
 */
export function parseDeclarations(source: string) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Convert TypeScript file to JSON Schema, following imports.
 *
 * @example
 * ```ts
 * const schema = toJsonSchemaFromFile('./types/user.ts', {
 *   followImports: 'local',
 *   rootType: 'User'
 * });
 * ```
 */
export function toJsonSchemaFromFile(
  entryPath: string,
  options?: EmitterOptions
): JSONSchema {
  const followMode = options?.followImports ?? "none";
  const baseDir = options?.baseDir ?? path.dirname(path.resolve(entryPath));

  if (followMode === "none") {
    // Single-file mode (backward compatible)
    const source = fs.readFileSync(entryPath, "utf-8");
    return toJsonSchema(source, options);
  }

  // Multi-file mode
  const resolver = new ModuleResolver({ followImports: followMode, baseDir });
  const declarations = resolver.resolveFromEntry(entryPath);
  const emitter = new Emitter(declarations, options);
  return emitter.emit();
}

/**
 * Generates JSON schemas for all types in a TypeScript file, following imports.
 *
 * This is the batch version of toJsonSchemaFromFile(). It resolves imports
 * and generates standalone schemas for all exported types in one pass.
 *
 * @param entryPath - Path to the TypeScript file
 * @param options - Schema generation options (rootType is ignored)
 * @returns Map of type name to JSON schema
 *
 * @example
 * ```ts
 * // schemas.ts:
 * // import TreeNode from "../../src/schemas/TreeNode";
 * // export interface GetTree_12_ResSchema extends TreeNode {}
 *
 * const schemas = toJsonSchemasFromFile('./schemas.ts', {
 *   followImports: 'local'
 * });
 *
 * console.log(schemas.GetTree_12_ResSchema);
 * // {
 * //   "$ref": "#/definitions/TreeNode",
 * //   "definitions": { "TreeNode": { ... } }  // ✅ Included!
 * // }
 * ```
 */
export function toJsonSchemasFromFile(
  entryPath: string,
  options?: Omit<EmitterOptions, 'rootType'>
): Record<string, JSONSchema> {
  const followMode = options?.followImports ?? "none";
  const baseDir = options?.baseDir ?? path.dirname(path.resolve(entryPath));

  if (followMode === "none") {
    // Single-file mode (backward compatible)
    const source = fs.readFileSync(entryPath, "utf-8");
    return toJsonSchemas(source, options);
  }

  // Multi-file mode
  const resolver = new ModuleResolver({ followImports: followMode, baseDir });
  const declarations = resolver.resolveFromEntry(entryPath);
  const emitter = new Emitter(declarations, options || {});
  return emitter.emitAll();
}
