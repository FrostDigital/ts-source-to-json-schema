// ============================================================================
// Tokenizer - Breaks TypeScript source into a stream of tokens
// ============================================================================

export type TokenType =
  | "keyword"       // interface, type, export, extends, enum, const
  | "primitive"     // string, number, boolean, null, undefined, any, unknown, never, void, object, bigint
  | "identifier"    // any other name
  | "string"        // "hello" or 'hello'
  | "number"        // 42, 3.14
  | "punctuation"   // { } ( ) [ ] : ; , ? | & = < > .
  | "jsdoc"         // /** ... */
  | "newline"       // \n
  | "eof";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  "interface", "type", "export", "extends", "enum", "const", "readonly",
  "import", "from", "as",
]);

const PRIMITIVES = new Set([
  "string", "number", "boolean", "null", "undefined",
  "any", "unknown", "never", "void", "object", "bigint",
  "true", "false",
]);

const PUNCTUATION = new Set([
  "{", "}", "(", ")", "[", "]", ":", ";", ",", "?", "|", "&", "=", "<", ">", ".", "*",
]);

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  function peek(offset = 0): string {
    return source[i + offset] ?? "";
  }

  function advance(count = 1): string {
    let result = "";
    for (let j = 0; j < count; j++) {
      const ch = source[i];
      if (ch === "\n") { line++; col = 1; }
      else { col++; }
      result += ch;
      i++;
    }
    return result;
  }

  function skipWhitespace() {
    while (i < source.length && /[ \t\r]/.test(peek())) {
      advance();
    }
  }

  function readString(quote: string): string {
    advance(); // opening quote
    let value = "";
    while (i < source.length && peek() !== quote) {
      if (peek() === "\\") {
        advance(); // backslash
        value += advance(); // escaped char
      } else {
        value += advance();
      }
    }
    if (i < source.length) advance(); // closing quote
    return value;
  }

  function readJSDoc(): string {
    // We're at '/', next is '*', then '*'
    let value = "";
    advance(); // /
    advance(); // *
    advance(); // *
    while (i < source.length) {
      if (peek() === "*" && peek(1) === "/") {
        advance(); // *
        advance(); // /
        break;
      }
      value += advance();
    }
    return value.trim();
  }

  function readLineComment() {
    // Skip // comments
    while (i < source.length && peek() !== "\n") {
      advance();
    }
  }

  function readBlockComment() {
    advance(); // /
    advance(); // *
    while (i < source.length) {
      if (peek() === "*" && peek(1) === "/") {
        advance(); // *
        advance(); // /
        return;
      }
      advance();
    }
  }

  function readWord(): string {
    let word = "";
    while (i < source.length && /[a-zA-Z0-9_$]/.test(peek())) {
      word += advance();
    }
    return word;
  }

  function readNumber(): string {
    let num = "";
    // Handle negative numbers
    if (peek() === "-") {
      num += advance();
    }
    while (i < source.length && /[0-9.]/.test(peek())) {
      num += advance();
    }
    return num;
  }

  while (i < source.length) {
    skipWhitespace();
    if (i >= source.length) break;

    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Newlines
    if (ch === "\n") {
      advance();
      tokens.push({ type: "newline", value: "\n", line: startLine, col: startCol });
      continue;
    }

    // JSDoc comments: /** ... */
    if (ch === "/" && peek(1) === "*" && peek(2) === "*" && peek(3) !== "/") {
      const value = readJSDoc();
      tokens.push({ type: "jsdoc", value, line: startLine, col: startCol });
      continue;
    }

    // Block comments: /* ... */
    if (ch === "/" && peek(1) === "*") {
      readBlockComment();
      continue;
    }

    // Line comments: // ...
    if (ch === "/" && peek(1) === "/") {
      readLineComment();
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const value = readString(ch);
      tokens.push({ type: "string", value, line: startLine, col: startCol });
      continue;
    }

    // Template literal (backtick) - read as string for now
    if (ch === "`") {
      advance(); // opening backtick
      let value = "";
      while (i < source.length && peek() !== "`") {
        value += advance();
      }
      if (i < source.length) advance(); // closing backtick
      tokens.push({ type: "string", value, line: startLine, col: startCol });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(peek(1)))) {
      const value = readNumber();
      tokens.push({ type: "number", value, line: startLine, col: startCol });
      continue;
    }

    // Words (keywords, primitives, identifiers)
    if (/[a-zA-Z_$]/.test(ch)) {
      const word = readWord();
      if (PRIMITIVES.has(word)) {
        tokens.push({ type: "primitive", value: word, line: startLine, col: startCol });
      } else if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word, line: startLine, col: startCol });
      } else {
        tokens.push({ type: "identifier", value: word, line: startLine, col: startCol });
      }
      continue;
    }

    // Punctuation
    if (PUNCTUATION.has(ch)) {
      advance();
      tokens.push({ type: "punctuation", value: ch, line: startLine, col: startCol });
      continue;
    }

    // Unknown character - skip
    advance();
  }

  tokens.push({ type: "eof", value: "", line, col });
  return tokens;
}
