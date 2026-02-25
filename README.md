# ts-to-jsonschema

A zero-dependency TypeScript-to-JSON Schema converter that uses its own mini-parser instead of the TypeScript compiler.

It parses TypeScript type declarations (interfaces, type aliases, enums) directly from source strings and emits JSON Schema (2020-12 draft). No `ts.createProgram`, no `node_modules` bloat, no compiler startup cost.

## Why

Existing tools like `ts-json-schema-generator` and `typescript-json-schema` rely on the full TypeScript compiler API to resolve types. That works, but it's slow, heavy, and ties you to Node.js.

This library takes a different approach: instead of running the type checker, it tokenizes and parses a **practical subset** of TypeScript's type syntax directly. The result is a tool that's fast enough to run in a hot path, portable enough to run anywhere (Cloudflare Workers, browser, CLI), and simple enough to extend.

The trade-off is explicit: it handles the type constructs you'd actually use in API contracts, tool schemas, and config definitions — not the full type-level programming language.

## What it handles

- **Declarations**: `interface`, `type`, `enum` (string + numeric), `export`
- **Primitives**: `string`, `number`, `boolean`, `null`, `undefined`, `any`, `unknown`, `never`, `void`, `bigint`
- **Literal types**: `"active"`, `42`, `true`
- **Unions**: `A | B | C` → `anyOf` (or `enum` when all members are literals)
- **Intersections**: `A & B` → `allOf`
- **Arrays**: `T[]`, `Array<T>`, nested `T[][]`
- **Tuples**: `[string, number]` → `prefixItems`
- **Nullable**: `string | null` → `type: ["string", "null"]`
- **Nested objects**: inline `{ foo: string }` and cross-references via `$ref`
- **Self-referential types**: `Task` containing `subtasks: Task[]`
- **Interface extends**: `interface Dog extends Animal` → `allOf`
- **Index signatures**: `[key: string]: T` → `additionalProperties`
- **Utility types**: `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `Readonly<T>`, `Set<T>`, `Map<K, V>`, `Promise<T>` (unwrapped)
- **JSDoc**: `/** description */` → `description`, plus tags: `@minimum`, `@maximum`, `@minLength`, `@maxLength`, `@pattern`, `@format`, `@default`, `@deprecated`, `@title`, `@example`, `@additionalProperties`
- **Readonly**: `readonly` → `readOnly` in schema

## Installation

```bash
npm install
```

## Development

```bash
# Run tests
npm test

# Build the project
npm run build

# Run an example
npx tsx example.ts
```

## Usage

```typescript
import { toJsonSchema } from "./src/index.js";

const schema = toJsonSchema(`
  /** Input for the ad analysis tool */
  interface AnalyzeAdInput {
    /** URL of the ad to analyze */
    url: string;
    /** Platform the ad is from */
    platform: "instagram" | "facebook" | "tiktok";
    /** Whether to extract color palette */
    extractColors?: boolean;
    /** Max elements to identify
     * @minimum 1
     * @maximum 50
     * @default 10
     */
    maxElements?: number;
    tags: string[];
  }
`, { rootType: "AnalyzeAdInput" });
```

Output:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "description": "Input for the ad analysis tool",
  "properties": {
    "url": { "type": "string", "description": "URL of the ad to analyze" },
    "platform": {
      "type": "string",
      "enum": ["instagram", "facebook", "tiktok"],
      "description": "Platform the ad is from"
    },
    "extractColors": { "type": "boolean", "description": "Whether to extract color palette" },
    "maxElements": {
      "type": "number",
      "description": "Max elements to identify",
      "minimum": 1,
      "maximum": 50,
      "default": 10
    },
    "tags": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["url", "platform", "tags"]
}
```

## Options

```typescript
toJsonSchema(source, {
  rootType: "MyType",            // Emit this type as the root schema (others go in $defs)
  includeSchema: true,           // Include $schema field (default: true)
  strictObjects: false,          // Set additionalProperties: false on all objects
  schemaVersion: "https://json-schema.org/draft/2020-12/schema",
  includeJSDoc: true,            // Include JSDoc descriptions and tags (default: true)
  additionalProperties: undefined, // Default value for additionalProperties (undefined, true, or false)
});
```

### `includeJSDoc` (optional)
- **Type:** `boolean`
- **Default:** `true`
- **Description:** Controls whether JSDoc comments are processed and included in the schema

When `true` (default):
- Interface/type descriptions are extracted from JSDoc comments
- Property descriptions are included
- JSDoc tags like `@minimum`, `@maximum`, `@pattern` are applied as constraints

When `false`:
- All JSDoc comments are ignored
- Schema only contains structural information (types, properties, required fields)
- Useful for generating minimal schemas or when descriptions aren't needed

**Example:**
```typescript
const schema = toJsonSchema(`
  /** User profile */
  interface User {
    /** @minLength 1 */
    name: string;
  }
`, { rootType: 'User', includeJSDoc: false });

// Result: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
// No description or minLength constraint
```

### `additionalProperties` (optional)
- **Type:** `boolean | undefined`
- **Default:** `undefined`
- **Description:** Sets the default value for `additionalProperties` on all object schemas

This option provides a global default for `additionalProperties` when not explicitly set via JSDoc or index signatures.

**Precedence (highest to lowest):**
1. Index signature: `[key: string]: T` → `additionalProperties: T`
2. JSDoc `@additionalProperties` tag
3. `strictObjects` option
4. `additionalProperties` option
5. Not set (JSON Schema default behavior)

**Example:**
```typescript
// Set all objects to disallow additional properties by default
const schema = toJsonSchema(`
  interface User {
    name: string;
  }
`, { rootType: 'User', additionalProperties: false });

// Result: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false }
```

### `@additionalProperties` JSDoc Tag

Control `additionalProperties` on specific types or properties using the `@additionalProperties` JSDoc tag.

**Supported values:** `true` | `false` (case-insensitive)

**Usage at interface/type level:**
```typescript
/**
 * Strict configuration object
 * @additionalProperties false
 */
interface Config {
  host: string;
  port: number;
}
// Result: { type: 'object', properties: {...}, additionalProperties: false }
```

**Usage at property level:**
```typescript
interface Settings {
  /**
   * Database configuration
   * @additionalProperties false
   */
  database: {
    host: string;
    port: number;
  };
}
// Result: database property has additionalProperties: false
```

**Interaction with other options:**
- When `includeJSDoc: false`, the tag is ignored
- The tag overrides the global `additionalProperties` and `strictObjects` options
- Index signatures take precedence over the tag

## What it doesn't handle

Anything that requires the type checker to evaluate:

- Conditional types (`T extends U ? X : Y`)
- Mapped types (`{ [K in keyof T]: ... }`)
- Template literal types (`` `${A}-${B}` ``)
- `typeof`, `keyof`, `infer`
- Generics (user-defined, beyond the built-in utility types)
- Cross-file imports

If you need these, use `ts-json-schema-generator`. If your types look like API contracts and tool definitions, this is probably all you need.