// ============================================================================
// AST Node Types - The intermediate representation between parsing and emission
// ============================================================================

/** A property in an object/interface type */
export interface PropertyNode {
  name: string;
  type: TypeNode;
  optional: boolean;
  readonly: boolean;
  description?: string;
  tags?: Record<string, string>; // JSDoc tags like @minimum, @default, @pattern, etc.
}

/** Index signature: [key: string]: ValueType */
export interface IndexSignatureNode {
  keyType: TypeNode;
  valueType: TypeNode;
}

/** All possible type AST nodes */
export type TypeNode =
  | { kind: "primitive"; value: "string" | "number" | "boolean" | "null" | "undefined" | "any" | "unknown" | "never" | "void" | "object" | "bigint" }
  | { kind: "literal_string"; value: string }
  | { kind: "literal_number"; value: number }
  | { kind: "literal_boolean"; value: boolean }
  | { kind: "object"; properties: PropertyNode[]; indexSignature?: IndexSignatureNode }
  | { kind: "array"; element: TypeNode }
  | { kind: "tuple"; elements: TupleElement[] }
  | { kind: "union"; members: TypeNode[] }
  | { kind: "intersection"; members: TypeNode[] }
  | { kind: "reference"; name: string; typeArgs?: TypeNode[] }
  | { kind: "parenthesized"; inner: TypeNode }
  | { kind: "template_literal"; parts: (string | TypeNode)[] }
  | { kind: "record"; keyType: TypeNode; valueType: TypeNode }
  | { kind: "mapped"; keyName: string; constraint: TypeNode; valueType: TypeNode; optional?: boolean };

export interface TupleElement {
  type: TypeNode;
  optional?: boolean;
  label?: string; // named tuple: [name: string, age: number]
  rest?: boolean;  // ...string[]
}

/** Top-level declarations we extract from source */
export type Declaration =
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration;

export interface InterfaceDeclaration {
  kind: "interface";
  name: string;
  extends?: string[];
  properties: PropertyNode[];
  indexSignature?: IndexSignatureNode;
  description?: string;
  exported: boolean;
}

export interface TypeAliasDeclaration {
  kind: "type_alias";
  name: string;
  type: TypeNode;
  description?: string;
  exported: boolean;
}

export interface EnumDeclaration {
  kind: "enum";
  name: string;
  members: { name: string; value: string | number }[];
  description?: string;
  exported: boolean;
}
