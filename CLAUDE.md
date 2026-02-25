# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **zero-dependency TypeScript-to-JSON Schema converter** that uses a custom mini-parser instead of the TypeScript compiler. It converts a practical subset of TypeScript type syntax to JSON Schema (2020-12 draft).

**Key characteristics:**
- No TypeScript compiler dependency - uses custom tokenizer/parser
- Fast and portable (works in Node.js, browsers, Cloudflare Workers)
- Handles TypeScript constructs commonly used in API contracts and config definitions
- Supports JSDoc comments with constraint tags

## Build and Test Commands

```bash
# Build TypeScript to dist/
npm run build

# Run all tests (uses Jest with ESM + ts-jest)
npm test

# Run specific test file or pattern
npm test -- primitives          # Match by filename
npm test -- additional-properties

# Watch mode for TDD
npm test:watch

# Coverage report
npm test:coverage

# Clean build artifacts
npm run clean

# Quick example run (uses tsx)
npx tsx example.ts
```

## Architecture: Three-Phase Pipeline

The codebase uses a classic compiler pipeline pattern:

```
TypeScript Source → [Tokenizer] → Tokens → [Parser] → AST → [Emitter] → JSON Schema
```

### Phase 1: Tokenizer (`src/tokenizer.ts`)
- **Input:** Raw TypeScript source string
- **Output:** Array of `Token` objects
- **Responsibilities:**
  - Lexical analysis (characters → tokens)
  - Recognizes keywords, primitives, identifiers, strings, numbers, punctuation
  - Extracts JSDoc comments (`/** ... */`) as special tokens
  - Skips single-line comments (`//`) and whitespace (except newlines)
  - Tracks line/column positions for error reporting

**Key tokens:**
- `keyword`: `interface`, `type`, `enum`, `export`, `extends`, `const`, `readonly`
- `primitive`: `string`, `number`, `boolean`, `null`, `undefined`, `any`, `unknown`, `never`, `void`, `object`, `bigint`
- `jsdoc`: JSDoc comments are tokenized as a single token containing the raw comment text
- `identifier`: Type names, property names, etc.

### Phase 2: Parser (`src/parser.ts`)
- **Input:** Token stream from tokenizer
- **Output:** Array of `Declaration` nodes (AST)
- **Responsibilities:**
  - Recursive descent parsing
  - Builds abstract syntax tree from tokens
  - Parses JSDoc comments into `{ description, tags }` objects
  - Associates JSDoc with declarations and properties
  - Handles TypeScript syntax: interfaces, type aliases, enums, unions, intersections, tuples, etc.

**JSDoc handling:**
- Parser maintains `pendingJSDoc` state
- JSDoc tokens are consumed before parsing declarations/properties
- JSDoc is parsed into:
  - `description`: Non-tag lines joined into a string
  - `tags`: Object mapping `@tagName` to values (e.g., `{ minimum: "0", pattern: "^[A-Z]" }`)

**AST structure (see `src/ast.ts`):**
- `Declaration` = `InterfaceDeclaration | TypeAliasDeclaration | EnumDeclaration`
- `TypeNode` = discriminated union of 15+ type kinds (primitive, object, union, intersection, etc.)
- `PropertyNode` = object property with name, type, optional flag, readonly flag, JSDoc

### Phase 3: Emitter (`src/emitter.ts`)
- **Input:** AST declarations + options
- **Output:** JSON Schema object
- **Responsibilities:**
  - Transforms AST nodes into JSON Schema (2020-12 draft)
  - Handles `$ref` generation for type references
  - Resolves utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`, etc.)
  - Applies JSDoc tags to schema properties (via `applyJSDocTags()`)
  - Manages `additionalProperties` precedence rules

**Key methods:**
- `emit()`: Entry point, emits root schema with optional `$defs`
- `emitDeclaration()`: Routes to interface/type/enum emitters
- `emitType()`: Recursive type visitor (handles 15+ type node kinds)
- `emitObjectType()`: Emits object schemas with properties, required array, additionalProperties
- `applyJSDocTags()`: Applies constraint tags (`@minimum`, `@maxLength`, `@pattern`, etc.)

## JSDoc Support

The library has **full JSDoc support** with two control mechanisms:

### 1. Configuration Options
- **`includeJSDoc`** (default: `true`): Master switch for all JSDoc processing
  - When `false`: All JSDoc comments are ignored (structural schema only)
  - Gated at emit time in `emitInterface`, `emitTypeAlias`, `emitEnum`, `emitObjectType`

- **`additionalProperties`** (default: `undefined`): Global default for `additionalProperties`

### 2. JSDoc Tags
Supported tags (applied to schema properties):
- **Numeric constraints:** `@minimum`, `@maximum`
- **String constraints:** `@minLength`, `@maxLength`, `@pattern`, `@format`
- **Metadata:** `@default`, `@example`, `@deprecated`, `@title`
- **Object control:** `@additionalProperties` (true/false, case-insensitive)

**Tag application precedence for `additionalProperties`:**
1. Index signature: `[key: string]: T`
2. `@additionalProperties` JSDoc tag
3. `strictObjects` option
4. `additionalProperties` option
5. Not set (JSON Schema default)

## Configuration Options (`EmitterOptions`)

All options are optional and have sensible defaults:

```typescript
interface EmitterOptions {
  includeSchema?: boolean;        // Default: true
  schemaVersion?: string;         // Default: "https://json-schema.org/draft/2020-12/schema"
  strictObjects?: boolean;        // Default: false (sets additionalProperties: false globally)
  rootType?: string;              // Default: "" (if set, emits this type as root, others in $defs)
  includeJSDoc?: boolean;         // Default: true
  additionalProperties?: boolean; // Default: undefined
}
```

## Test Organization

Tests are organized in `tests/` directory:

- **`tests/unit/`**: Feature-focused tests
  - `primitives.test.ts`: Basic types (string, number, boolean, etc.)
  - `arrays-and-tuples.test.ts`: Array syntax and tuple handling
  - `unions-and-literals.test.ts`: Union types and literal types
  - `intersections.test.ts`: Intersection types and interface extends
  - `objects-and-references.test.ts`: Object types, $ref generation
  - `enums.test.ts`: String and numeric enums
  - `utility-types.test.ts`: Partial, Required, Pick, Omit, Record, etc.
  - `jsdoc.test.ts`: JSDoc descriptions and constraint tags

- **`tests/integration/`**: Complex scenarios and options
  - `complex.test.ts`: Real-world API schemas, discriminated unions
  - `jsdoc-config.test.ts`: includeJSDoc option behavior
  - `additional-properties.test.ts`: additionalProperties option and @additionalProperties tag

## Common Patterns

### Adding a New JSDoc Tag
1. Add tag name to `applyJSDocTags()` switch in `src/emitter.ts`
2. Parse the tag value and apply to schema
3. Update README supported tags list
4. Add tests in `tests/unit/jsdoc.test.ts`

### Adding a New Type Node Kind
1. Add new variant to `TypeNode` union in `src/ast.ts`
2. Parse it in `src/parser.ts` (usually in `parseType()` or `parsePrimary()`)
3. Handle it in `emitType()` switch in `src/emitter.ts`
4. Add unit tests covering the new type

### Handling Precedence Rules
When multiple options/annotations can control the same output (like `additionalProperties`):
1. Define clear precedence order (document in README)
2. Implement in a single location (e.g., `emitObjectType()`)
3. Use early returns or if-else chain following precedence order
4. Add integration tests verifying precedence (`tests/integration/`)

## Git Commit Convention

Follow Conventional Commits format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test additions/modifications

Example: `feat: add @multipleOf JSDoc tag support`

**Important:** Never mention Claude Code in git commit messages.

## Code Style

- **Strict TypeScript:** Project uses strict mode, no implicit any
- **ESM only:** All imports use `.js` extensions (TypeScript ESM convention)
- **Comments:** Each major file has a banner comment explaining its purpose
- **Function organization:** Group related functions with section comments
- **No external dependencies:** Keep zero-dependency promise (dev dependencies OK)

## Testing Philosophy

- **Comprehensive coverage:** Each TypeScript construct should have unit tests
- **Real-world scenarios:** Integration tests should mirror actual use cases (API schemas, config objects)
- **Precedence verification:** When multiple options interact, test all combinations
- **Negative cases:** Test that invalid input produces helpful errors or graceful fallbacks
