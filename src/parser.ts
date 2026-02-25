// ============================================================================
// Parser - Recursive descent parser for TypeScript type declarations
// ============================================================================

import type { Token, TokenType } from "./tokenizer.js";
import type {
  Declaration, TypeNode, PropertyNode, InterfaceDeclaration,
  TypeAliasDeclaration, EnumDeclaration, IndexSignatureNode, TupleElement,
} from "./ast.js";

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(`${message} at line ${token.line}:${token.col} (got ${token.type}: "${token.value}")`);
  }
}

export class Parser {
  private pos = 0;
  private pendingJSDoc: { description: string; tags: Record<string, string> } | null = null;

  constructor(private tokens: Token[]) {}

  // ---------------------------------------------------------------------------
  // Token navigation
  // ---------------------------------------------------------------------------

  private peek(): Token {
    // Skip newlines when peeking
    let p = this.pos;
    while (p < this.tokens.length && this.tokens[p].type === "newline") {
      p++;
    }
    return this.tokens[p] ?? { type: "eof", value: "", line: 0, col: 0 };
  }

  private advance(): Token {
    this.skipNewlines();
    return this.tokens[this.pos++];
  }

  private skipNewlines() {
    while (this.pos < this.tokens.length && this.tokens[this.pos].type === "newline") {
      this.pos++;
    }
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.advance();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new ParseError(
        `Expected ${type}${value ? ` "${value}"` : ""}, got ${token.type} "${token.value}"`,
        token
      );
    }
    return token;
  }

  private match(type: TokenType, value?: string): Token | null {
    const next = this.peek();
    if (next.type === type && (value === undefined || next.value === value)) {
      return this.advance();
    }
    return null;
  }

  private is(type: TokenType, value?: string): boolean {
    const next = this.peek();
    return next.type === type && (value === undefined || next.value === value);
  }

  // ---------------------------------------------------------------------------
  // JSDoc parsing
  // ---------------------------------------------------------------------------

  private consumeJSDoc(): { description: string; tags: Record<string, string> } | null {
    const doc = this.pendingJSDoc;
    this.pendingJSDoc = null;
    return doc;
  }

  private parseJSDocComment(raw: string): { description: string; tags: Record<string, string> } {
    const lines = raw.split("\n").map(l => l.replace(/^\s*\*\s?/, "").trim());
    const tags: Record<string, string> = {};
    const descParts: string[] = [];

    for (const line of lines) {
      const tagMatch = line.match(/^@(\w+)\s*(.*)/);
      if (tagMatch) {
        tags[tagMatch[1]] = tagMatch[2].trim();
      } else if (line) {
        descParts.push(line);
      }
    }

    return { description: descParts.join(" "), tags };
  }

  // ---------------------------------------------------------------------------
  // Top-level parsing
  // ---------------------------------------------------------------------------

  parse(): Declaration[] {
    const declarations: Declaration[] = [];

    while (!this.is("eof")) {
      this.skipNewlines();

      // Collect JSDoc
      if (this.is("jsdoc")) {
        const token = this.advance();
        this.pendingJSDoc = this.parseJSDocComment(token.value);
        continue;
      }

      // Skip 'export'
      const exported = !!this.match("keyword", "export");

      if (this.is("keyword", "interface")) {
        declarations.push(this.parseInterface(exported));
      } else if (this.is("keyword", "type")) {
        declarations.push(this.parseTypeAlias(exported));
      } else if (this.is("keyword", "enum") || (this.is("keyword", "const") && this.peekAhead("keyword", "enum"))) {
        declarations.push(this.parseEnum(exported));
      } else {
        // Skip unknown tokens
        this.advance();
      }
    }

    return declarations;
  }

  private peekAhead(type: TokenType, value?: string): boolean {
    // Look ahead past current token (skipping newlines)
    let p = this.pos;
    while (p < this.tokens.length && this.tokens[p].type === "newline") p++;
    p++; // skip current
    while (p < this.tokens.length && this.tokens[p].type === "newline") p++;
    const t = this.tokens[p];
    return t?.type === type && (value === undefined || t.value === value);
  }

  // ---------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------

  private parseInterface(exported: boolean): InterfaceDeclaration {
    const jsdoc = this.consumeJSDoc();
    this.expect("keyword", "interface");
    const name = this.expect("identifier").value;

    // extends clause
    let extendsNames: string[] | undefined;
    if (this.match("keyword", "extends")) {
      extendsNames = [this.expect("identifier").value];
      while (this.match("punctuation", ",")) {
        extendsNames.push(this.expect("identifier").value);
      }
    }

    const { properties, indexSignature } = this.parseObjectBody();

    return {
      kind: "interface",
      name,
      extends: extendsNames,
      properties,
      indexSignature,
      description: jsdoc?.description,
      exported,
    };
  }

  // ---------------------------------------------------------------------------
  // Type alias
  // ---------------------------------------------------------------------------

  private parseTypeAlias(exported: boolean): TypeAliasDeclaration {
    const jsdoc = this.consumeJSDoc();
    this.expect("keyword", "type");
    const name = this.expect("identifier").value;

    // Skip generic params: type Foo<T> = ...
    if (this.match("punctuation", "<")) {
      let depth = 1;
      while (depth > 0 && !this.is("eof")) {
        if (this.is("punctuation", "<")) depth++;
        if (this.is("punctuation", ">")) depth--;
        this.advance();
      }
    }

    this.expect("punctuation", "=");
    const type = this.parseType();

    // Optional semicolon
    this.match("punctuation", ";");

    return {
      kind: "type_alias",
      name,
      type,
      description: jsdoc?.description,
      exported,
    };
  }

  // ---------------------------------------------------------------------------
  // Enum
  // ---------------------------------------------------------------------------

  private parseEnum(exported: boolean): EnumDeclaration {
    const jsdoc = this.consumeJSDoc();
    this.match("keyword", "const"); // const enum
    this.expect("keyword", "enum");
    const name = this.expect("identifier").value;

    this.expect("punctuation", "{");
    const members: { name: string; value: string | number }[] = [];
    let autoIndex = 0;

    while (!this.is("punctuation", "}") && !this.is("eof")) {
      this.skipNewlines();
      if (this.is("jsdoc")) { this.advance(); continue; } // skip member JSDoc for now
      if (this.is("punctuation", "}")) break;

      const memberName = this.expect("identifier").value;
      let memberValue: string | number = autoIndex;

      if (this.match("punctuation", "=")) {
        if (this.is("string")) {
          memberValue = this.advance().value;
        } else if (this.is("number")) {
          memberValue = Number(this.advance().value);
          autoIndex = (memberValue as number) + 1;
        } else {
          // Unknown initializer, skip
          this.advance();
        }
      } else {
        autoIndex++;
      }

      members.push({ name: memberName, value: memberValue });
      this.match("punctuation", ",");
    }

    this.expect("punctuation", "}");

    return {
      kind: "enum",
      name,
      members,
      description: jsdoc?.description,
      exported,
    };
  }

  // ---------------------------------------------------------------------------
  // Object body parsing (shared between interface and inline object types)
  // ---------------------------------------------------------------------------

  private parseObjectBody(): { properties: PropertyNode[]; indexSignature?: IndexSignatureNode } {
    this.expect("punctuation", "{");
    const properties: PropertyNode[] = [];
    let indexSignature: IndexSignatureNode | undefined;

    while (!this.is("punctuation", "}") && !this.is("eof")) {
      this.skipNewlines();

      // Collect member JSDoc
      let memberJSDoc: { description: string; tags: Record<string, string> } | null = null;
      if (this.is("jsdoc")) {
        memberJSDoc = this.parseJSDocComment(this.advance().value);
      }

      this.skipNewlines();
      if (this.is("punctuation", "}")) break;

      // Index signature: [key: string]: ValueType
      if (this.is("punctuation", "[") && this.peekIsIndexSignature()) {
        indexSignature = this.parseIndexSignature();
        this.match("punctuation", ";");
        this.match("punctuation", ",");
        continue;
      }

      // Regular property
      const readonly = !!this.match("keyword", "readonly");
      const propName = this.advance().value; // identifier or string
      const optional = !!this.match("punctuation", "?");
      this.expect("punctuation", ":");
      const propType = this.parseType();

      properties.push({
        name: propName,
        type: propType,
        optional,
        readonly,
        description: memberJSDoc?.description,
        tags: memberJSDoc?.tags,
      });

      // Semicolons and commas are optional
      this.match("punctuation", ";");
      this.match("punctuation", ",");
    }

    this.expect("punctuation", "}");
    return { properties, indexSignature };
  }

  private peekIsIndexSignature(): boolean {
    // Look ahead: [ identifier : type ] : type
    // Simple heuristic: after [, is there identifier then : ?
    let p = this.pos;
    // skip [
    p++;
    while (p < this.tokens.length && this.tokens[p].type === "newline") p++;
    // should be identifier
    if (this.tokens[p]?.type !== "identifier" && this.tokens[p]?.type !== "primitive") return false;
    p++;
    while (p < this.tokens.length && this.tokens[p].type === "newline") p++;
    // should be :
    return this.tokens[p]?.value === ":";
  }

  private parseIndexSignature(): IndexSignatureNode {
    this.expect("punctuation", "[");
    this.advance(); // key name (identifier)
    this.expect("punctuation", ":");
    const keyType = this.parseType();
    this.expect("punctuation", "]");
    this.expect("punctuation", ":");
    const valueType = this.parseType();
    return { keyType, valueType };
  }

  // ---------------------------------------------------------------------------
  // Type parsing - the core recursive descent
  // ---------------------------------------------------------------------------

  /** Entry point: handles union (lowest precedence) */
  parseType(): TypeNode {
    return this.parseUnion();
  }

  private parseUnion(): TypeNode {
    // Handle leading |
    this.match("punctuation", "|");

    let left = this.parseIntersection();

    if (this.is("punctuation", "|")) {
      const members = [left];
      while (this.match("punctuation", "|")) {
        members.push(this.parseIntersection());
      }
      return { kind: "union", members };
    }

    return left;
  }

  private parseIntersection(): TypeNode {
    // Handle leading &
    this.match("punctuation", "&");

    let left = this.parsePostfix();

    if (this.is("punctuation", "&")) {
      const members = [left];
      while (this.match("punctuation", "&")) {
        members.push(this.parsePostfix());
      }
      return { kind: "intersection", members };
    }

    return left;
  }

  private parsePostfix(): TypeNode {
    let type = this.parsePrimary();

    // Handle T[] and T[][] etc.
    while (this.is("punctuation", "[")) {
      // Check if it's [] (array) vs [number] (indexed access - not supported, skip)
      const nextAfterBracket = this.lookAheadPastBracket();
      if (nextAfterBracket === "]") {
        this.advance(); // [
        this.advance(); // ]
        type = { kind: "array", element: type };
      } else {
        break;
      }
    }

    return type;
  }

  private lookAheadPastBracket(): string {
    let p = this.pos;
    // skip [
    p++;
    while (p < this.tokens.length && this.tokens[p].type === "newline") p++;
    return this.tokens[p]?.value ?? "";
  }

  private parsePrimary(): TypeNode {
    const token = this.peek();

    // Primitive types
    if (token.type === "primitive") {
      this.advance();
      if (token.value === "true") return { kind: "literal_boolean", value: true };
      if (token.value === "false") return { kind: "literal_boolean", value: false };
      return { kind: "primitive", value: token.value as any };
    }

    // String literal type
    if (token.type === "string") {
      this.advance();
      return { kind: "literal_string", value: token.value };
    }

    // Number literal type
    if (token.type === "number") {
      this.advance();
      return { kind: "literal_number", value: Number(token.value) };
    }

    // Parenthesized type: (string | number)
    if (this.is("punctuation", "(")) {
      this.advance();
      const inner = this.parseType();
      this.expect("punctuation", ")");
      return { kind: "parenthesized", inner };
    }

    // Tuple or array type: [string, number]
    if (this.is("punctuation", "[")) {
      return this.parseTuple();
    }

    // Inline object type: { foo: string; bar: number }
    if (this.is("punctuation", "{")) {
      const { properties, indexSignature } = this.parseObjectBody();
      return { kind: "object", properties, indexSignature };
    }

    // readonly keyword before array
    if (this.is("keyword", "readonly")) {
      this.advance();
      const inner = this.parsePostfix();
      // readonly T[] is still just T[] for schema purposes
      return inner;
    }

    // Type reference: SomeType, Array<T>, Record<K,V>, etc.
    if (token.type === "identifier") {
      return this.parseTypeReference();
    }

    throw new ParseError(`Unexpected token`, token);
  }

  private parseTuple(): TypeNode {
    this.expect("punctuation", "[");
    const elements: TupleElement[] = [];

    while (!this.is("punctuation", "]") && !this.is("eof")) {
      const rest = !!this.match("punctuation", ".");
      if (rest) {
        this.expect("punctuation", ".");
        this.expect("punctuation", ".");
      }

      // Check for named tuple: name: Type
      let label: string | undefined;
      if (this.is("identifier") && this.peekAhead("punctuation", ":")) {
        label = this.advance().value;
        this.advance(); // :
      }

      const type = this.parseType();
      const optional = !!this.match("punctuation", "?");

      elements.push({ type, optional, label, rest });

      if (!this.match("punctuation", ",")) break;
    }

    this.expect("punctuation", "]");
    return { kind: "tuple", elements };
  }

  private parseTypeReference(): TypeNode {
    const name = this.advance().value;

    // Generic type arguments: Foo<Bar, Baz>
    let typeArgs: TypeNode[] | undefined;
    if (this.is("punctuation", "<")) {
      this.advance(); // <
      typeArgs = [];
      while (!this.is("punctuation", ">") && !this.is("eof")) {
        typeArgs.push(this.parseType());
        if (!this.match("punctuation", ",")) break;
      }
      this.expect("punctuation", ">");
    }

    // Handle well-known generic types inline
    if (name === "Array" && typeArgs?.length === 1) {
      return { kind: "array", element: typeArgs[0] };
    }

    if (name === "Record" && typeArgs?.length === 2) {
      return { kind: "record", keyType: typeArgs[0], valueType: typeArgs[1] };
    }

    if (name === "Promise" && typeArgs?.length === 1) {
      // Unwrap Promise for schema purposes
      return typeArgs[0];
    }

    if (typeArgs) {
      return { kind: "reference", name, typeArgs };
    }

    return { kind: "reference", name };
  }
}
