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
- **JSDoc**: `/** description */` → `description`, plus tags: `@minimum`, `@maximum`, `@minLength`, `@maxLength`, `@pattern`, `@format`, `@default`, `@deprecated`, `@title`, `@example`
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
  rootType: "MyType",       // Emit this type as the root schema (others go in $defs)
  includeSchema: true,      // Include $schema field (default: true)
  strictObjects: false,     // Set additionalProperties: false on all objects
  schemaVersion: "https://json-schema.org/draft/2020-12/schema",
});
```

## What it doesn't handle

Anything that requires the type checker to evaluate:

- Conditional types (`T extends U ? X : Y`)
- Mapped types (`{ [K in keyof T]: ... }`)
- Template literal types (`` `${A}-${B}` ``)
- `typeof`, `keyof`, `infer`
- Generics (user-defined, beyond the built-in utility types)
- Cross-file imports

If you need these, use `ts-json-schema-generator`. If your types look like API contracts and tool definitions, this is probably all you need.