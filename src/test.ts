// ============================================================================
// Test suite for ts-to-jsonschema
// ============================================================================

import { toJsonSchema, parseDeclarations } from "./index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertDeepEqual(actual: any, expected: any, path = "$") {
  if (actual === expected) return;
  if (typeof actual !== typeof expected) {
    throw new Error(`${path}: type mismatch - got ${typeof actual}, expected ${typeof expected}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  }
  if (typeof actual !== "object" || actual === null) {
    throw new Error(`${path}: value mismatch\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`);
  }
  if (Array.isArray(expected)) {
    assert(Array.isArray(actual), `${path}: expected array`);
    assert(actual.length === expected.length, `${path}: array length mismatch (${actual.length} vs ${expected.length})`);
    for (let i = 0; i < expected.length; i++) {
      assertDeepEqual(actual[i], expected[i], `${path}[${i}]`);
    }
    return;
  }
  const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of allKeys) {
    assertDeepEqual(actual[key], expected[key], `${path}.${key}`);
  }
}

// ============================================================================
console.log("\n🧪 Basic primitives");
// ============================================================================

test("simple interface with primitives", () => {
  const schema = toJsonSchema(`
    interface User {
      name: string;
      age: number;
      active: boolean;
    }
  `, { rootType: "User", includeSchema: false });

  assertDeepEqual(schema, {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      active: { type: "boolean" },
    },
    required: ["name", "age", "active"],
  });
});

test("optional properties", () => {
  const schema = toJsonSchema(`
    interface Config {
      host: string;
      port?: number;
      debug?: boolean;
    }
  `, { rootType: "Config", includeSchema: false });

  assertDeepEqual(schema.required, ["host"]);
  assert(schema.properties!.port !== undefined, "port should exist");
  assert(schema.properties!.debug !== undefined, "debug should exist");
});

// ============================================================================
console.log("\n🧪 Literal types and unions");
// ============================================================================

test("string literal union → enum", () => {
  const schema = toJsonSchema(`
    type Status = "active" | "inactive" | "pending";
  `, { rootType: "Status", includeSchema: false });

  assertDeepEqual(schema, {
    type: "string",
    enum: ["active", "inactive", "pending"],
  });
});

test("number literal union → enum", () => {
  const schema = toJsonSchema(`
    type HttpCode = 200 | 404 | 500;
  `, { rootType: "HttpCode", includeSchema: false });

  assertDeepEqual(schema, {
    type: "number",
    enum: [200, 404, 500],
  });
});

test("mixed union → anyOf", () => {
  const schema = toJsonSchema(`
    type Value = string | number | boolean;
  `, { rootType: "Value", includeSchema: false });

  assertDeepEqual(schema, {
    anyOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
    ],
  });
});

test("nullable type: string | null", () => {
  const schema = toJsonSchema(`
    type MaybeString = string | null;
  `, { rootType: "MaybeString", includeSchema: false });

  assertDeepEqual(schema, {
    type: ["string", "null"],
  });
});

// ============================================================================
console.log("\n🧪 Arrays and tuples");
// ============================================================================

test("array shorthand: string[]", () => {
  const schema = toJsonSchema(`
    type Tags = string[];
  `, { rootType: "Tags", includeSchema: false });

  assertDeepEqual(schema, {
    type: "array",
    items: { type: "string" },
  });
});

test("Array<T> generic", () => {
  const schema = toJsonSchema(`
    type Numbers = Array<number>;
  `, { rootType: "Numbers", includeSchema: false });

  assertDeepEqual(schema, {
    type: "array",
    items: { type: "number" },
  });
});

test("tuple type", () => {
  const schema = toJsonSchema(`
    type Pair = [string, number];
  `, { rootType: "Pair", includeSchema: false });

  assertDeepEqual(schema, {
    type: "array",
    prefixItems: [
      { type: "string" },
      { type: "number" },
    ],
    minItems: 2,
    maxItems: 2,
  });
});

// ============================================================================
console.log("\n🧪 Nested objects and references");
// ============================================================================

test("nested inline object", () => {
  const schema = toJsonSchema(`
    interface Order {
      id: string;
      shipping: {
        address: string;
        city: string;
        zip: string;
      };
    }
  `, { rootType: "Order", includeSchema: false });

  assert(schema.properties!.shipping.type === "object", "shipping should be object");
  assert(schema.properties!.shipping.properties!.address.type === "string", "address should be string");
});

test("type reference with $ref", () => {
  const schema = toJsonSchema(`
    interface Address {
      street: string;
      city: string;
    }
    interface User {
      name: string;
      address: Address;
    }
  `, { rootType: "User", includeSchema: false });

  assertDeepEqual(schema.properties!.address, { $ref: "#/$defs/Address" });
  assert(schema.$defs!.Address !== undefined, "Address should be in $defs");
});

// ============================================================================
console.log("\n🧪 Enums");
// ============================================================================

test("string enum", () => {
  const schema = toJsonSchema(`
    enum Color {
      Red = "red",
      Green = "green",
      Blue = "blue",
    }
  `, { rootType: "Color", includeSchema: false });

  assertDeepEqual(schema, {
    type: "string",
    enum: ["red", "green", "blue"],
  });
});

test("numeric enum", () => {
  const schema = toJsonSchema(`
    enum Priority {
      Low,
      Medium,
      High,
    }
  `, { rootType: "Priority", includeSchema: false });

  assertDeepEqual(schema, {
    type: "number",
    enum: [0, 1, 2],
  });
});

// ============================================================================
console.log("\n🧪 Utility types");
// ============================================================================

test("Partial<T>", () => {
  const schema = toJsonSchema(`
    interface User {
      name: string;
      age: number;
    }
    type PartialUser = Partial<User>;
  `, { rootType: "PartialUser", includeSchema: false });

  assert(schema.type === "object", "should be object");
  assert(!schema.required || schema.required.length === 0, "no required properties");
});

test("Pick<T, K>", () => {
  const schema = toJsonSchema(`
    interface User {
      name: string;
      age: number;
      email: string;
    }
    type UserSummary = Pick<User, "name" | "email">;
  `, { rootType: "UserSummary", includeSchema: false });

  assert(schema.properties!.name !== undefined, "name should exist");
  assert(schema.properties!.email !== undefined, "email should exist");
  assert(schema.properties!.age === undefined, "age should not exist");
});

test("Omit<T, K>", () => {
  const schema = toJsonSchema(`
    interface User {
      name: string;
      age: number;
      password: string;
    }
    type SafeUser = Omit<User, "password">;
  `, { rootType: "SafeUser", includeSchema: false });

  assert(schema.properties!.name !== undefined, "name should exist");
  assert(schema.properties!.age !== undefined, "age should exist");
  assert(schema.properties!.password === undefined, "password should not exist");
});

test("Record<string, T>", () => {
  const schema = toJsonSchema(`
    type Scores = Record<string, number>;
  `, { rootType: "Scores", includeSchema: false });

  assertDeepEqual(schema, {
    type: "object",
    additionalProperties: { type: "number" },
  });
});

test("Record with literal keys", () => {
  const schema = toJsonSchema(`
    type Config = Record<"host" | "port", string>;
  `, { rootType: "Config", includeSchema: false });

  assert(schema.properties!.host !== undefined, "host should exist");
  assert(schema.properties!.port !== undefined, "port should exist");
  assertDeepEqual(schema.required, ["host", "port"]);
});

// ============================================================================
console.log("\n🧪 JSDoc support");
// ============================================================================

test("JSDoc descriptions", () => {
  const schema = toJsonSchema(`
    /** A user in the system */
    interface User {
      /** The user's display name */
      name: string;
      /** Age in years */
      age: number;
    }
  `, { rootType: "User", includeSchema: false });

  assert(schema.description === "A user in the system", "interface description");
  assert(schema.properties!.name.description === "The user's display name", "name description");
  assert(schema.properties!.age.description === "Age in years", "age description");
});

test("JSDoc tags → schema constraints", () => {
  const schema = toJsonSchema(`
    interface Product {
      /**
       * Product name
       * @minLength 1
       * @maxLength 100
       */
      name: string;
      /**
       * Price in cents
       * @minimum 0
       * @maximum 999999
       */
      price: number;
      /**
       * Email address
       * @format email
       */
      email: string;
      /**
       * @pattern ^[A-Z]{2}[0-9]{4}$
       */
      code: string;
      /**
       * @default "active"
       */
      status: string;
      /**
       * @deprecated
       */
      legacyField: string;
    }
  `, { rootType: "Product", includeSchema: false });

  assert(schema.properties!.name.minLength === 1, "minLength");
  assert(schema.properties!.name.maxLength === 100, "maxLength");
  assert(schema.properties!.price.minimum === 0, "minimum");
  assert(schema.properties!.price.maximum === 999999, "maximum");
  assert(schema.properties!.email.format === "email", "format");
  assert(schema.properties!.code.pattern === "^[A-Z]{2}[0-9]{4}$", "pattern");
  assert(schema.properties!.status.default === "active", "default");
  assert(schema.properties!.legacyField.deprecated === true, "deprecated");
});

// ============================================================================
console.log("\n🧪 Intersection types");
// ============================================================================

test("intersection → allOf", () => {
  const schema = toJsonSchema(`
    interface Base {
      id: string;
    }
    interface WithTimestamps {
      createdAt: string;
      updatedAt: string;
    }
    type Model = Base & WithTimestamps;
  `, { rootType: "Model", includeSchema: false });

  assert(schema.allOf !== undefined, "should use allOf");
  assert(schema.allOf!.length === 2, "two members");
});

// ============================================================================
console.log("\n🧪 Interface extends");
// ============================================================================

test("interface extends", () => {
  const schema = toJsonSchema(`
    interface Animal {
      name: string;
    }
    interface Dog extends Animal {
      breed: string;
    }
  `, { rootType: "Dog", includeSchema: false });

  assert(schema.allOf !== undefined, "should use allOf for extends");
  const refPart = schema.allOf!.find((s: any) => s.$ref);
  assert(refPart !== undefined, "should have $ref to parent");
});

// ============================================================================
console.log("\n🧪 Index signatures");
// ============================================================================

test("index signature", () => {
  const schema = toJsonSchema(`
    interface Headers {
      [key: string]: string;
    }
  `, { rootType: "Headers", includeSchema: false });

  assertDeepEqual(schema, {
    type: "object",
    additionalProperties: { type: "string" },
  });
});

test("properties + index signature", () => {
  const schema = toJsonSchema(`
    interface Config {
      name: string;
      [key: string]: unknown;
    }
  `, { rootType: "Config", includeSchema: false });

  assert(schema.properties!.name.type === "string", "named property");
  assert(schema.additionalProperties !== undefined, "has additionalProperties");
});

// ============================================================================
console.log("\n🧪 Complex / real-world examples");
// ============================================================================

test("agent tool schema", () => {
  const schema = toJsonSchema(`
    /** Input for the ad analysis tool */
    interface AnalyzeAdInput {
      /** URL of the ad to analyze */
      url: string;
      /** Platform the ad is from */
      platform: "instagram" | "facebook" | "tiktok";
      /** Whether to extract color palette */
      extractColors?: boolean;
      /** Maximum number of elements to identify
       * @minimum 1
       * @maximum 50
       * @default 10
       */
      maxElements?: number;
      /** Tags to apply */
      tags: string[];
    }
  `, { rootType: "AnalyzeAdInput", includeSchema: false });

  assert(schema.description === "Input for the ad analysis tool", "description");
  assert(schema.properties!.url.type === "string", "url is string");
  assertDeepEqual(schema.properties!.platform, {
    type: "string",
    enum: ["instagram", "facebook", "tiktok"],
    description: "Platform the ad is from",
  });
  assert(schema.properties!.maxElements.minimum === 1, "minimum constraint");
  assert(schema.properties!.maxElements.maximum === 50, "maximum constraint");
  assert(schema.properties!.maxElements.default === 10, "default value");
  assertDeepEqual(schema.required, ["url", "platform", "tags"]);
});

test("multi-type file with cross-references", () => {
  const schema = toJsonSchema(`
    type Priority = "low" | "medium" | "high";

    interface Author {
      name: string;
      email: string;
    }

    interface Task {
      title: string;
      description?: string;
      priority: Priority;
      assignee: Author;
      subtasks: Task[];
    }
  `, { rootType: "Task", includeSchema: true });

  assert(schema.$schema !== undefined, "should have $schema");
  assert(schema.$defs!.Priority !== undefined, "Priority in $defs");
  assert(schema.$defs!.Author !== undefined, "Author in $defs");
  assert(schema.properties!.priority.$ref === "#/$defs/Priority", "priority ref");
  assert(schema.properties!.assignee.$ref === "#/$defs/Author", "assignee ref");
  // Self-referential
  assert(schema.properties!.subtasks.type === "array", "subtasks is array");
  assert(schema.properties!.subtasks.items!.$ref === "#/$defs/Task", "subtasks items ref to Task");
});

test("discriminated union pattern", () => {
  const schema = toJsonSchema(`
    interface TextBlock {
      type: "text";
      content: string;
    }
    interface ImageBlock {
      type: "image";
      url: string;
      alt?: string;
    }
    interface VideoBlock {
      type: "video";
      url: string;
      duration: number;
    }
    type ContentBlock = TextBlock | ImageBlock | VideoBlock;
  `, { rootType: "ContentBlock", includeSchema: false });

  assert(schema.anyOf !== undefined, "should be anyOf");
  assert(schema.anyOf!.length === 3, "three variants");
});

test("readonly and nested arrays", () => {
  const schema = toJsonSchema(`
    interface Matrix {
      readonly rows: number;
      readonly cols: number;
      data: number[][];
    }
  `, { rootType: "Matrix", includeSchema: false });

  assert(schema.properties!.rows.readOnly === true, "rows readonly");
  assert(schema.properties!.data.type === "array", "data is array");
  assert(schema.properties!.data.items!.type === "array", "nested array");
  assert(schema.properties!.data.items!.items!.type === "number", "number elements");
});

// ============================================================================
console.log("\n🧪 Edge cases");
// ============================================================================

test("empty interface", () => {
  const schema = toJsonSchema(`
    interface Empty {}
  `, { rootType: "Empty", includeSchema: false });

  assert(schema.type === "object", "should be object");
});

test("export keyword is handled", () => {
  const schema = toJsonSchema(`
    export interface Foo {
      bar: string;
    }
  `, { rootType: "Foo", includeSchema: false });

  assert(schema.properties!.bar.type === "string", "should parse exported interface");
});

test("single-line comments are ignored", () => {
  const schema = toJsonSchema(`
    // This is a comment
    interface Foo {
      // Another comment
      bar: string;
    }
  `, { rootType: "Foo", includeSchema: false });

  assert(schema.properties!.bar.type === "string", "should skip comments");
});

test("boolean literal types", () => {
  const schema = toJsonSchema(`
    interface Flags {
      alwaysTrue: true;
      alwaysFalse: false;
    }
  `, { rootType: "Flags", includeSchema: false });

  assertDeepEqual(schema.properties!.alwaysTrue, { const: true });
  assertDeepEqual(schema.properties!.alwaysFalse, { const: false });
});

test("Set<T> → uniqueItems array", () => {
  const schema = toJsonSchema(`
    type UniqueNames = Set<string>;
  `, { rootType: "UniqueNames", includeSchema: false });

  assertDeepEqual(schema, {
    type: "array",
    items: { type: "string" },
    uniqueItems: true,
  });
});

test("leading pipe in union", () => {
  const schema = toJsonSchema(`
    type Status =
      | "active"
      | "inactive"
      | "pending";
  `, { rootType: "Status", includeSchema: false });

  assertDeepEqual(schema, {
    type: "string",
    enum: ["active", "inactive", "pending"],
  });
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(60)}\n`);

if (failed > 0) process.exit(1);
