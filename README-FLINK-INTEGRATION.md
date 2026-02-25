# @flink-app/ts-source-to-json-schema

🧪 **Experimental** zero-dependency JSON Schema generator for Flink framework.

## Status

Early stage (v0.1.0). Used internally by @flink-app/flink when `FLINK_EXPERIMENTAL_FAST_SCHEMA=true`.

## Architecture

Three-phase pipeline: Tokenizer → Parser → Emitter

Significantly faster than ts-json-schema-generator but supports smaller TypeScript subset.

## Integration with Flink

This package is integrated into the Flink framework as an experimental fast schema generator. To use it:

```bash
FLINK_EXPERIMENTAL_FAST_SCHEMA=true pnpm run build
```

The generator automatically falls back to ts-json-schema-generator on any errors, ensuring zero risk.

## Supported Features

- Interfaces, types, enums
- Primitives, arrays, tuples
- Unions, intersections
- Utility types (Partial, Pick, Omit, Required, Record, etc.)
- JSDoc tags for constraints (@minimum, @maximum, @pattern, etc.)

## Not Supported

- Conditional types
- Mapped types
- Template literal types
- typeof/keyof/infer operators
- Cross-file type imports (types must be in the same file or copied to intermediate schema file)

## When to Use

- Projects with 100+ schemas where compile time matters
- Iterative development where fast feedback is valuable
- Testing performance optimizations

The experimental generator is designed for typical handler/tool schemas which use simple interfaces and types.

## Limitations

See main Flink documentation for complete supported/unsupported feature list.
