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

import { tokenize } from "./tokenizer.js";
import { Parser } from "./parser.js";
import { Emitter, type JSONSchema, type EmitterOptions } from "./emitter.js";

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
 * Parse TypeScript source and return the AST declarations.
 * Useful for inspection or custom transformations.
 */
export function parseDeclarations(source: string) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parse();
}
