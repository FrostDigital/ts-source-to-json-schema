# Test Suite Documentation

This directory contains the comprehensive test suite for `ts-source-to-json-schema`.

## Structure

```
tests/
├── unit/                    # Unit tests for specific features
│   ├── primitives.test.ts         # Basic types and primitives
│   ├── unions-and-literals.test.ts # Union and literal types
│   ├── arrays-and-tuples.test.ts  # Array and tuple types
│   ├── objects-and-references.test.ts # Objects, nesting, and $ref
│   ├── enums.test.ts              # Enum declarations
│   ├── utility-types.test.ts      # TypeScript utility types
│   ├── jsdoc.test.ts              # JSDoc comment support
│   └── intersections.test.ts      # Intersection types and extends
└── integration/             # Integration tests for complex scenarios
    └── complex.test.ts           # Real-world use cases
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run legacy test suite
npm run test:legacy
```

## Test Categories

### Unit Tests

#### Primitives (`primitives.test.ts`)
- Basic interface conversions
- Optional properties
- Special types (any, unknown, never)
- All primitive types (string, number, boolean, null, undefined, bigint)

#### Unions and Literals (`unions-and-literals.test.ts`)
- String literal unions → enum
- Number literal unions → enum
- Boolean literals
- Mixed unions → anyOf
- Nullable types (T | null)
- Leading pipe syntax

#### Arrays and Tuples (`arrays-and-tuples.test.ts`)
- Array shorthand (T[])
- Generic Array<T>
- Nested arrays
- Tuple types with prefixItems
- Set<T> with uniqueItems

#### Objects and References (`objects-and-references.test.ts`)
- Nested inline objects
- Type references with $ref
- Self-referential types (recursive)
- Index signatures → additionalProperties
- Empty interfaces

#### Enums (`enums.test.ts`)
- String enums
- Numeric enums (auto-increment and explicit)
- Exported enums

#### Utility Types (`utility-types.test.ts`)
- Partial<T>
- Required<T>
- Pick<T, K>
- Omit<T, K>
- Record<K, V>
- Readonly<T>
- Promise<T> (unwrapping)
- Map<K, V>

#### JSDoc Support (`jsdoc.test.ts`)
- Interface and property descriptions
- String constraints: @minLength, @maxLength, @pattern, @format
- Number constraints: @minimum, @maximum
- Other tags: @default, @deprecated, @example
- Combined tags on single property

#### Intersections (`intersections.test.ts`)
- Basic intersections → allOf
- Interface extends
- Mixed intersections with inline objects

### Integration Tests

#### Complex Scenarios (`complex.test.ts`)
- Agent tool schemas with JSDoc constraints
- Multi-type files with cross-references
- Discriminated union patterns
- Nested arrays and readonly properties
- Configuration schema structures
- Schema options (includeSchema, strictObjects, schemaVersion)
- Edge cases (export keyword, comments, trailing commas)

## Coverage

Run `npm run test:coverage` to generate a coverage report. Coverage reports are saved to the `coverage/` directory and include:
- Text summary in terminal
- HTML report at `coverage/index.html`
- LCOV report for CI integration

## Adding New Tests

When adding new tests:

1. **Identify the category**: Determine if it's a unit test for a specific feature or an integration test for a complex scenario

2. **Choose the right file**: Add to existing test files if the feature fits, or create a new file for new feature areas

3. **Follow naming conventions**:
   - Use descriptive test names: `should convert X to Y`
   - Group related tests with `describe` blocks
   - Use nested `describe` for subcategories

4. **Test structure**:
   ```typescript
   describe('Feature Category', () => {
     describe('Specific Feature', () => {
       it('should do something specific', () => {
         const schema = toJsonSchema(`...`, options);
         expect(schema).toEqual(expected);
       });
     });
   });
   ```

5. **Best practices**:
   - Test both success and edge cases
   - Keep test cases focused and isolated
   - Use clear TypeScript examples in test inputs
   - Verify the exact schema output, not just partial properties
   - Add comments for non-obvious behavior

## Current Coverage

- **Total Tests**: 81
- **Test Files**: 9
- **Categories**: 8 unit + 1 integration

The test suite covers all major features documented in the README and ensures the library works correctly across a wide range of TypeScript type constructs.
