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
- **Built-in types**: `Date` → `{ type: "string", format: "date-time" }`
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
- **Local imports**: Automatic resolution of relative imports (`./` and `../`) across files
- **JSDoc**: `/** description */` → `description`, plus tags: `@minimum`, `@maximum`, `@minLength`, `@maxLength`, `@pattern`, `@format`, `@default`, `@deprecated`, `@title`, `@example`, `@additionalProperties`
- **Readonly**: `readonly` → `readOnly` in schema

## Installation

```bash
npm install ts-source-to-json-schema
```

## CLI Usage

The package includes a command-line tool for converting TypeScript files to JSON Schema:

```bash
# Convert a TypeScript file
npx ts-source-to-json-schema src/types.ts

# Convert with automatic import resolution (default)
npx ts-source-to-json-schema src/api.ts

# Convert a specific type as the root schema
npx ts-source-to-json-schema src/api.ts --rootType ApiResponse

# Use strict mode (no additional properties allowed)
npx ts-source-to-json-schema src/config.ts --strictObjects

# Disable JSDoc processing
npx ts-source-to-json-schema src/types.ts --includeJSDoc false

# Single file mode, no imports
npx ts-source-to-json-schema src/types.ts --followImports none

# Combine multiple options
npx ts-source-to-json-schema src/user.ts -r User --strictObjects --followImports local
```

### CLI Options

```
-h, --help                     Show help message
-v, --version                  Show version number
    --doctor                   Output diagnostic information for debugging

-r, --rootType <name>          Emit this type as root (others in $defs)
-s, --includeSchema <bool>     Include $schema property (default: true)
    --schemaVersion <url>      Custom $schema URL
    --strictObjects            Set additionalProperties: false globally
    --additionalProperties     Set additionalProperties default (true/false)
    --includeJSDoc <bool>      Include JSDoc comments (default: true)

--followImports <mode>         Follow imports: none, local, all (default: local)
--baseDir <path>               Base directory for resolving imports
```

The CLI reads TypeScript files and outputs JSON Schema to stdout, making it easy to pipe to files or other tools:

```bash
# Save to file
npx ts-source-to-json-schema src/types.ts > schema.json

# Pretty-print with jq
npx ts-source-to-json-schema src/types.ts | jq '.'

# Use in scripts
npx ts-source-to-json-schema src/api.ts --rootType Request > openapi/request-schema.json
```

### Multi-File Support (`--followImports`)

By default, the CLI automatically follows local relative imports (`./` and `../`) to resolve type definitions across multiple files:

```typescript
// pet.ts
export interface Pet {
  _id: string;
  name: string;
  species: string;
}

// api.ts
import { Pet } from './pet';
export interface PostPetReq extends Omit<Pet, "_id"> {}
```

```bash
# Follows imports and resolves Pet type (default behavior)
npx ts-source-to-json-schema api.ts --rootType PostPetReq

# Output includes both Pet (in $defs) and PostPetReq (as root)
```

**Import Resolution Modes:**
- `local` (default in CLI): Follows relative imports (`./` and `../`), skips `node_modules`
- `none`: Single-file mode, does not follow any imports
- `all`: Reserved for future `node_modules` support (currently behaves like `local`)

**Key Features:**
- Circular dependency detection (no infinite loops)
- Duplicate name detection (errors if same type name in multiple files)
- Automatic extension resolution (`.ts`, `.tsx`, `.d.ts`)
- Index file support (`./types` → `./types/index.ts`)

**Examples:**

```bash
# Multi-file project with local imports
npx ts-source-to-json-schema src/api.ts --followImports local

# Single file only, ignore imports
npx ts-source-to-json-schema src/standalone.ts --followImports none

# Custom base directory for import resolution
npx ts-source-to-json-schema src/api.ts --baseDir ./src
```

### Diagnostics Mode (`--doctor`)

When you encounter issues with schema conversion, use the `--doctor` flag to output comprehensive diagnostic information that can be shared with developers:

```bash
npx ts-source-to-json-schema src/problematic-types.ts --doctor
```

The doctor output includes:
- **Timestamp**: When the conversion was attempted
- **Environment**: Node.js version, platform, architecture, and current working directory
- **Input file details**: Path, existence, size, modification time, source length, and full source code
- **Options used**: All configuration options passed to the converter
- **Conversion result**: Either the successfully generated schema or detailed error information with stack traces

This makes it easy to:
1. Copy-paste the full diagnostic output when reporting issues
2. Debug why a particular TypeScript file isn't converting as expected
3. Share reproducible examples with maintainers

**Example output:**
```json
{
  "timestamp": "2026-02-25T10:50:55.680Z",
  "environment": {
    "nodeVersion": "v20.17.0",
    "platform": "darwin",
    "arch": "arm64",
    "cwd": "/path/to/project"
  },
  "input": {
    "filePath": "types.ts",
    "absolutePath": "/absolute/path/to/types.ts",
    "fileExists": true,
    "fileSize": 486,
    "sourceLength": 486,
    "source": "interface User { ... }"
  },
  "options": { "rootType": "User" },
  "conversionResult": {
    "success": true,
    "schema": { ... }
  }
}
```

## Programmatic Usage

### String-Based API

```typescript
import { toJsonSchema } from "ts-source-to-json-schema";

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

### File-Based API with Import Resolution

```typescript
import { toJsonSchemaFromFile } from "ts-source-to-json-schema";

// Convert a TypeScript file with automatic import resolution
const schema = toJsonSchemaFromFile('./src/types/api.ts', {
  followImports: 'local',  // Follow relative imports
  rootType: 'ApiRequest',
  strictObjects: true
});

// Single-file mode (no import resolution)
const singleFileSchema = toJsonSchemaFromFile('./src/types.ts', {
  followImports: 'none'
});
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

toJsonSchemaFromFile(filePath, {
  // All options from toJsonSchema, plus:
  followImports: 'local',        // Follow imports: 'none' (default for API), 'local' (default for CLI), 'all'
  baseDir: './src',              // Base directory for resolving imports (default: dirname(filePath))
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

### `followImports` (optional)
- **Type:** `"none" | "local" | "all"`
- **Default:** `"none"` (programmatic API), `"local"` (CLI)
- **Description:** Controls import resolution across multiple TypeScript files

**Modes:**
- `none`: Single-file mode, imports are ignored
- `local`: Follows relative imports (`./` and `../`), skips `node_modules`
- `all`: Reserved for future `node_modules` support (currently behaves like `local`)

**Only available with `toJsonSchemaFromFile()`** — the string-based `toJsonSchema()` API does not support import resolution.

**Example:**
```typescript
// Given: pet.ts exports Pet interface
// Given: api.ts imports Pet and uses it in PostPetReq

const schema = toJsonSchemaFromFile('./api.ts', {
  followImports: 'local',
  rootType: 'PostPetReq'
});

// Result: Schema includes both Pet (in $defs) and PostPetReq
```

**Features:**
- Circular dependency detection (prevents infinite loops)
- Duplicate name detection (throws error if same type appears in multiple files)
- Automatic extension resolution (`.ts`, `.tsx`, `.d.ts`)
- Index file resolution (`./types` → `./types/index.ts`)

### `baseDir` (optional)
- **Type:** `string`
- **Default:** `path.dirname(filePath)`
- **Description:** Base directory for resolving relative imports

Only relevant when `followImports` is not `"none"`.

## What it doesn't handle

Anything that requires the type checker to evaluate:

- Conditional types (`T extends U ? X : Y`)
- Mapped types (`{ [K in keyof T]: ... }`)
- Template literal types (`` `${A}-${B}` ``)
- `typeof`, `keyof`, `infer`
- Generics (user-defined, beyond the built-in utility types)
- `node_modules` imports (planned for future)

If you need these, use `ts-json-schema-generator`. If your types look like API contracts and tool definitions, this is probably all you need.