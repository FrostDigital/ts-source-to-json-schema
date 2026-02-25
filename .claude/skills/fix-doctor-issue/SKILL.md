---
name: fix-doctor-issue
description: Analyze ts-source-to-json-schema --doctor output, identify TypeScript conversion issues (unsupported features, schema generation problems), create a test-driven fix plan for user approval, then implement the fix. Use when doctor output shows conversionResult.success=false or when TypeScript features aren't converting correctly.
argument-hint: <doctor-json>
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, EnterPlanMode, ExitPlanMode, AskUserQuestion
model: claude-sonnet-4-5
---

# Fix Doctor Issue Skill

This skill takes JSON output from `ts-source-to-json-schema --doctor` and:
1. **Analyzes** the diagnostic data to identify the root cause
2. **Creates a plan** using TDD approach with specific tests and fixes
3. **Gets user approval** before implementing
4. **Implements** the fix following the approved plan
5. **Verifies** with tests

## Workflow

### Phase 1: Parse and Analyze
1. Parse the doctor JSON from the argument: `$ARGS`
2. Extract key information:
   - Input file path and source code
   - Conversion result (success/error)
   - Error messages and stack traces
   - Options used
3. Identify the issue category:
   - **Unsupported TypeScript features**: conditional types, mapped types, template literals, typeof, keyof, infer, generics
   - **Schema generation issues**: incorrect schema output, missing types, wrong references
   - **Parse errors**: tokenization or parsing failures

### Phase 2: Create Fix Plan (with User Approval)
1. Enter plan mode using `EnterPlanMode`
2. In plan mode:
   - Read the source file from the diagnostic
   - Analyze the TypeScript constructs causing issues
   - Identify which features need refactoring
   - Design the fix strategy:
     - For unsupported features: refactor to supported equivalents
     - For schema issues: fix emitter/parser logic
   - Write a test-first plan:
     - Create failing tests that demonstrate the issue
     - Define expected schema output
     - Plan code changes to make tests pass
   - Document the plan in a markdown file
3. Use `ExitPlanMode` to request user approval

### Phase 3: Implement Fix (After Approval)
1. **Write tests first**:
   - Create a new test file in `tests/unit/` or `tests/integration/`
   - Add test cases that currently fail but represent the desired behavior
   - Run tests to confirm they fail
2. **Implement the fix**:
   - For unsupported TypeScript features: Refactor the source file to use supported syntax
   - For schema generation issues: Fix parser/emitter code in `src/`
3. **Verify the fix**:
   - Run the new tests - they should now pass
   - Run full test suite - no regressions
   - Run doctor again on the fixed file - success should be true

## Usage

```bash
# 1. Get doctor output
npx ts-source-to-json-schema problematic.ts --doctor > diagnostics.json

# 2. Copy the JSON content and invoke the skill
/fix-doctor-issue '{"timestamp":"...","input":{...},"conversionResult":{...}}'
```

Or pipe directly:
```bash
npx ts-source-to-json-schema problematic.ts --doctor | pbcopy
# Then: /fix-doctor-issue <paste>
```

## Issue Categories and Solutions

### Unsupported TypeScript Features

**Conditional Types**: `T extends U ? X : Y`
- **Solution**: Replace with union types or simplified types
- **Example**: `type Result<T> = T extends string ? string : number` → `type Result = string | number`

**Mapped Types**: `{ [K in keyof T]: ... }`
- **Solution**: Explicitly define the mapped properties
- **Example**: `type Flags<T> = { [K in keyof T]: boolean }` → Manually create interface with known keys

**Template Literal Types**: `` `${A}-${B}` ``
- **Solution**: Use string type or string literal union
- **Example**: `` type Status = `${State}-${Mode}` `` → `type Status = "active-read" | "active-write" | ...`

**Generics** (user-defined beyond utility types)
- **Solution**: Instantiate with concrete types
- **Example**: `interface Box<T> { value: T }` → `interface StringBox { value: string }`, `interface NumberBox { value: number }`

### Schema Generation Issues

These require code changes in `src/parser.ts` or `src/emitter.ts`:
- Missing support for specific syntax
- Incorrect $ref generation
- Wrong schema structure

## Key Files to Modify

- **Source file** (from diagnostics.input.absolutePath): Refactor TypeScript code
- **tests/**: Add new test cases
- **src/parser.ts**: Fix parsing logic if needed
- **src/emitter.ts**: Fix schema generation if needed

## Error Handling

If the JSON is malformed or missing required fields:
1. Show a clear error message
2. Explain what fields are expected
3. Show an example of valid doctor output

If the issue is unclear or ambiguous:
1. Use `AskUserQuestion` to clarify the approach
2. Present multiple fix options if applicable

## Success Criteria

✅ Tests pass (new tests + existing test suite)
✅ Doctor output shows `conversionResult.success: true`
✅ Generated schema matches expected structure
✅ No regressions in existing functionality
