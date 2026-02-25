// ============================================================================
// Import Parser - Extracts import statements from token stream
// ============================================================================

import type { Token } from "./tokenizer.js";

export interface ImportStatement {
  importedNames: string[];  // ['Pet', 'Dog'] or ['default'] or ['*']
  modulePath: string;       // './pet'
  isDefault: boolean;       // import X from "path"
  isNamespace: boolean;     // import * as X from "path"
  namespaceAlias?: string;  // The X in: import * as X from "path"
}

/**
 * Extract import statements from token stream.
 * Handles:
 *   - import { X, Y } from "path"
 *   - import X from "path"
 *   - import * as X from "path"
 *   - import { X as Y } from "path" (extracts original name X)
 */
export function extractImports(tokens: Token[]): ImportStatement[] {
  const imports: ImportStatement[] = [];
  let i = 0;

  function peek(offset = 0): Token | undefined {
    return tokens[i + offset];
  }

  function advance(): Token | undefined {
    return tokens[i++];
  }

  function expect(type: string, value?: string): Token {
    const token = advance();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(
        `Expected ${type}${value ? ` "${value}"` : ""} but got ${token?.type} "${token?.value}"`
      );
    }
    return token;
  }

  function skipNewlines() {
    while (peek()?.type === "newline") {
      advance();
    }
  }

  while (i < tokens.length) {
    const token = peek();
    if (!token || token.type === "eof") break;

    // Look for import keyword
    if (token.type === "keyword" && token.value === "import") {
      advance(); // consume 'import'
      skipNewlines();

      const importedNames: string[] = [];
      let isDefault = false;
      let isNamespace = false;
      let namespaceAlias: string | undefined;
      let modulePath = "";

      const next = peek();

      // import * as X from "path"
      if (next?.type === "punctuation" && next.value === "*") {
        advance(); // consume '*'
        skipNewlines();
        expect("keyword", "as");
        skipNewlines();
        const alias = expect("identifier");
        namespaceAlias = alias.value;
        importedNames.push("*");
        isNamespace = true;
      }
      // import { ... } from "path"
      else if (next?.type === "punctuation" && next.value === "{") {
        advance(); // consume '{'
        skipNewlines();

        // Read imported names until }
        while (peek()?.type !== "punctuation" || peek()?.value !== "}") {
          skipNewlines();
          const name = expect("identifier");
          importedNames.push(name.value);
          skipNewlines();

          // Handle: import { X as Y }
          if (peek()?.type === "keyword" && peek()?.value === "as") {
            advance(); // consume 'as'
            skipNewlines();
            expect("identifier"); // consume alias but keep original name
            skipNewlines();
          }

          // Handle comma
          if (peek()?.type === "punctuation" && peek()?.value === ",") {
            advance();
            skipNewlines();
          }
        }

        expect("punctuation", "}"); // consume '}'
      }
      // import X from "path" (default import)
      else if (next?.type === "identifier") {
        const name = expect("identifier");
        importedNames.push(name.value);
        isDefault = true;
      }

      skipNewlines();

      // Expect 'from' keyword
      if (peek()?.type === "keyword" && peek()?.value === "from") {
        expect("keyword", "from");
        skipNewlines();

        // Read module path (string)
        const pathToken = expect("string");
        modulePath = pathToken.value;

        imports.push({
          importedNames,
          modulePath,
          isDefault,
          isNamespace,
          namespaceAlias,
        });
      }

      // Skip to next statement (consume semicolon or newline if present)
      skipNewlines();
      if (peek()?.type === "punctuation" && peek()?.value === ";") {
        advance();
      }
    } else {
      advance(); // skip non-import tokens
    }
  }

  return imports;
}
