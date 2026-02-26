// ============================================================================
// Emitter - Transforms AST nodes into JSON Schema (2020-12 draft)
// ============================================================================

import path from "node:path";
import type {
  Declaration, TypeNode, PropertyNode, InterfaceDeclaration,
  TypeAliasDeclaration, EnumDeclaration, IndexSignatureNode,
} from "./ast.js";

export interface JSONSchema {
  $schema?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  items?: JSONSchema;
  prefixItems?: JSONSchema[];
  minItems?: number;
  maxItems?: number;
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  const?: unknown;
  enum?: unknown[];
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  deprecated?: boolean;
  readOnly?: boolean;
  examples?: unknown[];
  title?: string;
  [key: string]: unknown;
}

export interface EmitterOptions {
  /** Include $schema in the root. Default: true */
  includeSchema?: boolean;
  /** JSON Schema draft. Default: "https://json-schema.org/draft/2020-12/schema" */
  schemaVersion?: string;
  /** Set additionalProperties: false on all objects. Default: false */
  strictObjects?: boolean;
  /** Name of the root type to emit. If not set, emits all types under $defs */
  rootType?: string;
  /** Include JSDoc descriptions and tags in the schema. Default: true */
  includeJSDoc?: boolean;
  /** Default value for additionalProperties if not specified via JSDoc or index signature */
  additionalProperties?: boolean;
  /** Follow import statements: "none" (default in API), "local" (default in CLI), "all" */
  followImports?: "none" | "local" | "all";
  /** Base directory for resolving imports. Default: dirname(entryPath) or cwd */
  baseDir?: string;
  /**
   * How to handle duplicate type declarations across files.
   * - 'error': Throw error (strict, default)
   * - 'warn': Use first declaration, log warning
   * - 'silent': Use first declaration, no warning
   * Default: 'error'
   */
  onDuplicateDeclarations?: 'error' | 'warn' | 'silent';
  /**
   * Callback to transform type names in $defs and $ref pointers.
   * Useful for namespacing types by file, adding prefixes/suffixes, or custom naming schemes.
   *
   * @param originalName - The original type name from the TypeScript source
   * @param declaration - The AST declaration node for the type
   * @param context - File path context (undefined for string-based APIs, defined for file-based APIs)
   * @returns The transformed name to use in the schema
   *
   * @example
   * // Namespace by file path
   * defineNameTransform: (name, decl, context) => {
   *   if (!context) return name;
   *   const parts = context.relativePath.replace(/\.ts$/, '').split('/');
   *   return `${parts.join('_')}_${name}`;
   * }
   *
   * @example
   * // Add prefix by declaration kind
   * defineNameTransform: (name, decl) => {
   *   const prefix = decl.kind === 'interface' ? 'I' : 'T';
   *   return `${prefix}${name}`;
   * }
   */
  defineNameTransform?: (
    originalName: string,
    declaration: Declaration,
    context?: {
      absolutePath: string;
      relativePath: string;
    }
  ) => string;
}

export class Emitter {
  private declarations = new Map<string, Declaration>();
  private nameMapping = new Map<string, string>();
  private options: Required<Omit<EmitterOptions, 'defineNameTransform'>> & { defineNameTransform?: EmitterOptions['defineNameTransform'] };

  constructor(declarations: Declaration[], options: EmitterOptions = {}) {
    // Build name mapping BEFORE populating declarations map
    if (options.defineNameTransform) {
      const reverseMap = new Map<string, string[]>();

      for (const decl of declarations) {
        try {
          // Build context with both absolute and relative paths
          let context: { absolutePath: string; relativePath: string } | undefined;
          if (decl.sourceFile) {
            context = {
              absolutePath: decl.sourceFile,
              relativePath: path.relative(process.cwd(), decl.sourceFile)
            };
          }

          const transformedName = options.defineNameTransform(
            decl.name,
            decl,
            context
          );
          this.nameMapping.set(decl.name, transformedName);

          // Track for collision detection
          if (!reverseMap.has(transformedName)) {
            reverseMap.set(transformedName, []);
          }
          reverseMap.get(transformedName)!.push(decl.name);
        } catch (err) {
          throw new Error(
            `defineNameTransform callback threw error for type "${decl.name}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Check for collisions
      for (const [transformedName, originalNames] of reverseMap) {
        if (originalNames.length > 1) {
          throw new Error(
            `defineNameTransform produced duplicate name "${transformedName}" for types: ${originalNames.join(", ")}\n` +
            `Each transformed name must be unique. Please adjust your transform function.`
          );
        }
      }
    }

    for (const decl of declarations) {
      this.declarations.set(decl.name, decl);
    }

    this.options = {
      includeSchema: options.includeSchema ?? true,
      schemaVersion: options.schemaVersion ?? "https://json-schema.org/draft/2020-12/schema",
      strictObjects: options.strictObjects ?? false,
      rootType: options.rootType ?? "",
      includeJSDoc: options.includeJSDoc ?? true,
      additionalProperties: options.additionalProperties,
      followImports: options.followImports ?? "none",
      baseDir: options.baseDir ?? "",
      onDuplicateDeclarations: options.onDuplicateDeclarations ?? "error",
      defineNameTransform: options.defineNameTransform,
    };
  }

  private getDefineName(originalName: string): string {
    return this.nameMapping.get(originalName) ?? originalName;
  }

  /**
   * Check if a declaration is generic (has type parameters like T, U, V, W)
   */
  private isGenericDeclaration(decl: Declaration): boolean {
    const typeParamNames = ['T', 'U', 'V', 'W', 'K', 'TKey', 'TValue'];

    const hasTypeParamRef = (typeNode: TypeNode): boolean => {
      switch (typeNode.kind) {
        case "reference":
          // Check if this references a type parameter
          if (typeParamNames.includes(typeNode.name)) {
            return true;
          }
          // Check type arguments
          if (typeNode.typeArgs) {
            return typeNode.typeArgs.some(hasTypeParamRef);
          }
          return false;
        case "array":
          return hasTypeParamRef(typeNode.element);
        case "object":
          return typeNode.properties.some(p => hasTypeParamRef(p.type)) ||
                 (typeNode.indexSignature ? hasTypeParamRef(typeNode.indexSignature.valueType) : false);
        case "union":
          return typeNode.members.some(hasTypeParamRef);
        case "intersection":
          return typeNode.members.some(hasTypeParamRef);
        case "tuple":
          return typeNode.elements.some(e => hasTypeParamRef(e.type));
        case "record":
          return hasTypeParamRef(typeNode.keyType) || hasTypeParamRef(typeNode.valueType);
        case "parenthesized":
          return hasTypeParamRef(typeNode.inner);
        default:
          return false;
      }
    };

    if (decl.kind === "interface") {
      return decl.properties.some(p => hasTypeParamRef(p.type)) ||
             (decl.indexSignature ? hasTypeParamRef(decl.indexSignature.valueType) : false);
    } else if (decl.kind === "type_alias") {
      return hasTypeParamRef(decl.type);
    }

    return false; // Enums can't be generic
  }

  /**
   * Check if a type name is referenced anywhere without type arguments
   */
  private isReferencedWithoutTypeArgs(targetName: string): boolean {
    const hasRefWithoutArgs = (typeNode: TypeNode): boolean => {
      switch (typeNode.kind) {
        case "reference":
          // Found a reference to target without type args
          if (typeNode.name === targetName && (!typeNode.typeArgs || typeNode.typeArgs.length === 0)) {
            return true;
          }
          // Check type arguments
          if (typeNode.typeArgs) {
            return typeNode.typeArgs.some(hasRefWithoutArgs);
          }
          return false;
        case "array":
          return hasRefWithoutArgs(typeNode.element);
        case "object":
          return typeNode.properties.some(p => hasRefWithoutArgs(p.type)) ||
                 (typeNode.indexSignature ? hasRefWithoutArgs(typeNode.indexSignature.valueType) : false);
        case "union":
          return typeNode.members.some(hasRefWithoutArgs);
        case "intersection":
          return typeNode.members.some(hasRefWithoutArgs);
        case "tuple":
          return typeNode.elements.some(e => hasRefWithoutArgs(e.type));
        case "record":
          return hasRefWithoutArgs(typeNode.keyType) || hasRefWithoutArgs(typeNode.valueType);
        case "parenthesized":
          return hasRefWithoutArgs(typeNode.inner);
        default:
          return false;
      }
    };

    // Check all declarations
    for (const decl of this.declarations.values()) {
      if (decl.kind === "interface") {
        if (decl.properties.some(p => hasRefWithoutArgs(p.type))) return true;
        if (decl.indexSignature && hasRefWithoutArgs(decl.indexSignature.valueType)) return true;
        if (decl.extends && decl.extends.some(hasRefWithoutArgs)) return true;
      } else if (decl.kind === "type_alias") {
        if (hasRefWithoutArgs(decl.type)) return true;
      }
    }

    return false;
  }

  emit(): JSONSchema {
    const defs: Record<string, JSONSchema> = {};

    // Emit all declarations into $defs
    // Skip generic declarations (those with type parameters) unless they're referenced without type args
    for (const [name, decl] of this.declarations) {
      // Check if this is a generic declaration (has type parameter references)
      if (this.isGenericDeclaration(decl)) {
        // Only include if it's referenced without type arguments somewhere
        if (!this.isReferencedWithoutTypeArgs(name)) {
          continue; // Skip this generic declaration
        }
      }
      defs[this.getDefineName(name)] = this.emitDeclaration(decl);
    }

    // If a root type is specified, use it as the root schema
    if (this.options.rootType && defs[this.getDefineName(this.options.rootType)]) {
      const transformedRootName = this.getDefineName(this.options.rootType);
      const root = defs[transformedRootName];

      // Check if root type is self-referential (directly or transitively)
      // Use transformed name since defs keys are transformed
      const isSelfReferential = this.isTransitivelySelfReferential(transformedRootName, defs);

      if (isSelfReferential) {
        // Keep root in $defs and make root a $ref to it
        const result: JSONSchema = {
          $ref: `#/$defs/${transformedRootName}`,
        };
        if (this.options.includeSchema) {
          result.$schema = this.options.schemaVersion;
        }
        result.$defs = defs;
        return result;
      }

      // Not self-referential, emit normally
      delete defs[transformedRootName];

      const result: JSONSchema = { ...root };
      if (this.options.includeSchema) {
        result.$schema = this.options.schemaVersion;
      }
      if (Object.keys(defs).length > 0) {
        result.$defs = defs;
      }
      return result;
    }

    // Otherwise wrap everything under $defs
    const result: JSONSchema = {};
    if (this.options.includeSchema) {
      result.$schema = this.options.schemaVersion;
    }
    result.$defs = defs;
    return result;
  }

  /**
   * Emits schemas for all declarations at once.
   * More efficient than calling emit() multiple times.
   * Each schema is standalone with only its transitively referenced types in definitions.
   */
  emitAll(): Record<string, JSONSchema> {
    const schemas: Record<string, JSONSchema> = {};

    for (const [typeName, decl] of this.declarations) {
      const transformedName = this.getDefineName(typeName);
      schemas[transformedName] = this.emitDeclarationStandalone(decl);
    }

    return schemas;
  }

  /**
   * Emits a declaration as a standalone schema with minimal definitions.
   * Only includes types that are transitively referenced.
   * Uses "definitions" (draft-07 style) instead of "$defs" for compatibility.
   */
  private emitDeclarationStandalone(decl: Declaration): JSONSchema {
    // Find direct references from this declaration (not including the type itself)
    const directRefs = this.findDirectReferences(decl);

    // Collect all types transitively referenced (excluding the starting type)
    const referencedTypes = new Set<string>();
    for (const ref of directRefs) {
      this.collectTransitiveReferences(ref, referencedTypes);
    }

    // Check if this type is self-referential
    const selfReferenced = referencedTypes.has(decl.name);

    // Emit the main schema
    const schema = this.emitDeclaration(decl);

    // Build minimal definitions object
    const definitions: Record<string, JSONSchema> = {};

    // If type is self-referential, include it in its own definitions
    if (selfReferenced) {
      definitions[this.getDefineName(decl.name)] = schema;
    }

    // Add all referenced types
    for (const typeName of referencedTypes) {
      if (typeName !== decl.name) {
        const referencedDecl = this.declarations.get(typeName);
        if (referencedDecl) {
          const transformedName = this.getDefineName(typeName);
          definitions[transformedName] = this.emitDeclaration(referencedDecl);
        }
      }
    }

    // Convert $ref paths from #/$defs/ to #/definitions/
    const schemaWithDefinitions = this.convertRefsToDefinitions(schema);
    const convertedDefinitions: Record<string, JSONSchema> = {};
    for (const [name, def] of Object.entries(definitions)) {
      convertedDefinitions[name] = this.convertRefsToDefinitions(def);
    }

    // Build result schema with $schema if enabled
    const result: JSONSchema = {
      ...schemaWithDefinitions,
      definitions: Object.keys(convertedDefinitions).length > 0 ? convertedDefinitions : {}
    };

    // Add $schema if enabled (default: true)
    if (this.options.includeSchema !== false) {
      result.$schema = this.options.schemaVersion || "https://json-schema.org/draft/2020-12/schema";
    }

    return result;
  }

  /**
   * Recursively collects all type names that are transitively referenced by a given type.
   */
  private collectTransitiveReferences(startTypeName: string, visited: Set<string> = new Set()): Set<string> {
    if (visited.has(startTypeName)) {
      return visited;
    }

    visited.add(startTypeName);

    const decl = this.declarations.get(startTypeName);
    if (!decl) return visited;

    // Find all direct references in this declaration
    const directRefs = this.findDirectReferences(decl);

    // Recursively collect references from those types
    for (const ref of directRefs) {
      this.collectTransitiveReferences(ref, visited);
    }

    return visited;
  }

  /**
   * Finds all direct type references in a declaration.
   */
  private findDirectReferences(decl: Declaration): string[] {
    const refs: string[] = [];

    const collectRefs = (typeNode: TypeNode) => {
      switch (typeNode.kind) {
        case "reference":
          // Skip built-in types
          if (!this.isBuiltInType(typeNode.name)) {
            // If this reference has type arguments AND the type exists in declarations,
            // it will be instantiated inline, so don't add it as a dependency
            const hasTypeArgs = typeNode.typeArgs && typeNode.typeArgs.length > 0;
            const existsInDeclarations = this.declarations.has(typeNode.name);

            if (!hasTypeArgs || !existsInDeclarations) {
              // Add as dependency if: no type args, OR type doesn't exist (external ref)
              refs.push(typeNode.name);
            }
          }
          // Always collect from type arguments (they may reference other types)
          if (typeNode.typeArgs) {
            typeNode.typeArgs.forEach(arg => collectRefs(arg));
          }
          break;
        case "object":
          typeNode.properties.forEach(p => collectRefs(p.type));
          if (typeNode.indexSignature) {
            collectRefs(typeNode.indexSignature.keyType);
            collectRefs(typeNode.indexSignature.valueType);
          }
          break;
        case "array":
          collectRefs(typeNode.element);
          break;
        case "tuple":
          typeNode.elements.forEach(e => collectRefs(e.type));
          break;
        case "union":
          typeNode.members.forEach(m => collectRefs(m));
          break;
        case "intersection":
          typeNode.members.forEach(m => collectRefs(m));
          break;
        case "parenthesized":
          collectRefs(typeNode.inner);
          break;
        case "record":
          collectRefs(typeNode.keyType);
          collectRefs(typeNode.valueType);
          break;
        case "mapped":
          collectRefs(typeNode.constraint);
          collectRefs(typeNode.valueType);
          break;
      }
    };

    if (decl.kind === "interface") {
      decl.properties.forEach(p => collectRefs(p.type));
      if (decl.extends) {
        decl.extends.forEach(e => collectRefs(e));
      }
      if (decl.indexSignature) {
        collectRefs(decl.indexSignature.keyType);
        collectRefs(decl.indexSignature.valueType);
      }
    } else if (decl.kind === "type_alias") {
      collectRefs(decl.type);
    }
    // Enums don't have type references

    return refs;
  }

  /**
   * Checks if a type name refers to a built-in type that shouldn't be in definitions.
   */
  private isBuiltInType(name: string): boolean {
    const builtIns = [
      "Date", "Promise", "Array", "Set", "Map", "Record",
      "Partial", "Required", "Pick", "Omit", "Readonly", "NonNullable"
    ];
    return builtIns.includes(name);
  }

  /**
   * Recursively converts $ref paths from #/$defs/ to #/definitions/ in a schema.
   */
  private convertRefsToDefinitions(schema: JSONSchema): JSONSchema {
    if (typeof schema !== "object" || schema === null) {
      return schema;
    }

    const converted: JSONSchema = {};

    for (const [key, value] of Object.entries(schema)) {
      if (key === "$ref" && typeof value === "string") {
        // Convert #/$defs/TypeName to #/definitions/TypeName
        converted[key] = value.replace(/^#\/\$defs\//, "#/definitions/");
      } else if (Array.isArray(value)) {
        converted[key] = value.map(item =>
          typeof item === "object" ? this.convertRefsToDefinitions(item) : item
        );
      } else if (typeof value === "object" && value !== null) {
        converted[key] = this.convertRefsToDefinitions(value as JSONSchema);
      } else {
        converted[key] = value;
      }
    }

    return converted;
  }

  /**
   * Checks if a schema contains a reference to a specific type name.
   * Used to detect self-referential types.
   */
  private containsReference(schema: JSONSchema, typeName: string): boolean {
    if (typeof schema !== "object" || schema === null) {
      return false;
    }

    // Check if this is a direct reference to the type
    const transformedName = this.getDefineName(typeName);
    if (schema.$ref === `#/$defs/${transformedName}`) {
      return true;
    }

    // Recursively check all properties
    for (const value of Object.values(schema)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "object" && this.containsReference(item, typeName)) {
            return true;
          }
        }
      } else if (typeof value === "object" && value !== null) {
        if (this.containsReference(value as JSONSchema, typeName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a type is transitively self-referential.
   * This includes both direct recursion (A → A) and mutual recursion (A → B → A).
   */
  private isTransitivelySelfReferential(
    typeName: string,
    defs: Record<string, JSONSchema>
  ): boolean {
    // Helper to check if typeName is reachable from startType
    const canReach = (startType: string, targetType: string, visited: Set<string> = new Set()): boolean => {
      if (startType === targetType) {
        return true;
      }

      if (visited.has(startType)) {
        return false;
      }

      visited.add(startType);

      const schema = defs[startType];
      if (!schema) {
        return false;
      }

      // Get all types referenced by startType
      const refs = this.getReferencedTypes(schema);

      for (const ref of refs) {
        if (ref === targetType) {
          return true;
        }
        if (canReach(ref, targetType, visited)) {
          return true;
        }
      }

      return false;
    };

    // Check if typeName can reach itself (directly or transitively)
    const refs = this.getReferencedTypes(defs[typeName]);
    for (const ref of refs) {
      if (canReach(ref, typeName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extracts all type names referenced in a schema.
   */
  private getReferencedTypes(schema: JSONSchema): string[] {
    const refs: string[] = [];

    const collectRefs = (obj: any) => {
      if (typeof obj !== "object" || obj === null) {
        return;
      }

      if (obj.$ref && typeof obj.$ref === "string") {
        const match = obj.$ref.match(/^#\/\$defs\/(.+)$/);
        if (match) {
          refs.push(match[1]);
        }
      }

      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          value.forEach(collectRefs);
        } else if (typeof value === "object" && value !== null) {
          collectRefs(value);
        }
      }
    };

    collectRefs(schema);
    return refs;
  }

  // ---------------------------------------------------------------------------
  // Declaration emission
  // ---------------------------------------------------------------------------

  private emitDeclaration(decl: Declaration): JSONSchema {
    switch (decl.kind) {
      case "interface": return this.emitInterface(decl);
      case "type_alias": return this.emitTypeAlias(decl);
      case "enum": return this.emitEnum(decl);
    }
  }

  private emitInterface(decl: InterfaceDeclaration): JSONSchema {
    const schema = this.emitObjectType(decl.properties, decl.indexSignature, decl.tags);

    // Handle extends - merge parent properties via allOf
    if (decl.extends && decl.extends.length > 0) {
      const allOf: JSONSchema[] = decl.extends.map((typeNode) => {
        // If it's a simple reference, use $ref
        if (typeNode.kind === "reference" && !typeNode.typeArgs) {
          return { $ref: `#/$defs/${this.getDefineName(typeNode.name)}` };
        }
        // If it's a utility type or complex type, resolve it inline
        return this.emitType(typeNode);
      });

      // Only add the interface's own properties if it has any
      const hasOwnProperties = decl.properties.length > 0 || decl.indexSignature !== undefined;
      if (hasOwnProperties) {
        allOf.push(schema);
      }

      // If only one schema in allOf, unwrap it
      if (allOf.length === 1) {
        const result = allOf[0];
        if (this.options.includeJSDoc && decl.description) result.description = decl.description;
        return result;
      }

      const result: JSONSchema = { allOf };
      if (this.options.includeJSDoc && decl.description) result.description = decl.description;
      return result;
    }

    if (this.options.includeJSDoc && decl.description) schema.description = decl.description;
    return schema;
  }

  private emitTypeAlias(decl: TypeAliasDeclaration): JSONSchema {
    const schema = this.emitType(decl.type);
    if (this.options.includeJSDoc) {
      if (decl.description) schema.description = decl.description;
      // Apply @additionalProperties tag if this is an object type
      if (decl.tags?.additionalProperties !== undefined && schema.type === "object") {
        const value = decl.tags.additionalProperties.toLowerCase();
        if (value === "true") {
          schema.additionalProperties = true;
        } else if (value === "false") {
          schema.additionalProperties = false;
        }
      }
    }
    return schema;
  }

  private emitEnum(decl: EnumDeclaration): JSONSchema {
    const schema: JSONSchema = {
      enum: decl.members.map(m => m.value),
    };
    if (this.options.includeJSDoc && decl.description) schema.description = decl.description;

    // If all values are strings, add type: "string"
    if (decl.members.every(m => typeof m.value === "string")) {
      schema.type = "string";
    } else if (decl.members.every(m => typeof m.value === "number")) {
      schema.type = "number";
    }

    return schema;
  }

  // ---------------------------------------------------------------------------
  // Type node emission
  // ---------------------------------------------------------------------------

  private emitType(node: TypeNode): JSONSchema {
    switch (node.kind) {
      case "primitive": return this.emitPrimitive(node.value);
      case "literal_string": return { const: node.value };
      case "literal_number": return { const: node.value };
      case "literal_boolean": return { const: node.value };

      case "object":
        return this.emitObjectType(node.properties, node.indexSignature);

      case "array":
        return { type: "array", items: this.emitType(node.element) };

      case "tuple":
        return this.emitTuple(node);

      case "union":
        return this.emitUnion(node.members);

      case "intersection":
        return this.emitIntersection(node.members);

      case "reference":
        return this.emitReference(node);

      case "parenthesized":
        return this.emitType(node.inner);

      case "record":
        return this.emitRecord(node.keyType, node.valueType);

      case "template_literal":
        return { type: "string" }; // Best we can do without regex generation

      case "mapped":
        return { type: "object" }; // Fallback

      default:
        return {};
    }
  }

  private emitPrimitive(value: string): JSONSchema {
    switch (value) {
      case "string": return { type: "string" };
      case "number": return { type: "number" };
      case "boolean": return { type: "boolean" };
      case "null": return { type: "null" };
      case "undefined": return {}; // no JSON Schema equivalent
      case "bigint": return { type: "integer" };
      case "any": return {}; // accepts anything
      case "unknown": return {}; // accepts anything
      case "void": return {}; // no value
      case "never": return { not: {} }; // matches nothing
      case "object": return { type: "object" };
      default: return {};
    }
  }

  private emitObjectType(properties: PropertyNode[], indexSignature?: IndexSignatureNode, tags?: Record<string, string>): JSONSchema {
    const schema: JSONSchema = { type: "object" };
    const props: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const prop of properties) {
      const propSchema = this.emitType(prop.type);

      // Apply JSDoc tags
      if (this.options.includeJSDoc) {
        if (prop.description) propSchema.description = prop.description;
        if (prop.tags) this.applyJSDocTags(propSchema, prop.tags);
      }
      if (prop.readonly) propSchema.readOnly = true;

      props[prop.name] = propSchema;
      if (!prop.optional) required.push(prop.name);
    }

    if (Object.keys(props).length > 0) {
      schema.properties = props;
    }
    if (required.length > 0) {
      schema.required = required;
    }

    // Handle additionalProperties in order of precedence:
    // 1. Index signature
    // 2. @additionalProperties JSDoc tag
    // 3. strictObjects option
    // 4. additionalProperties option
    if (indexSignature) {
      schema.additionalProperties = this.emitType(indexSignature.valueType);
    } else if (this.options.includeJSDoc && tags?.additionalProperties !== undefined) {
      const value = tags.additionalProperties.toLowerCase();
      if (value === "true") {
        schema.additionalProperties = true;
      } else if (value === "false") {
        schema.additionalProperties = false;
      }
    } else if (this.options.strictObjects) {
      schema.additionalProperties = false;
    } else if (this.options.additionalProperties !== undefined) {
      schema.additionalProperties = this.options.additionalProperties;
    }

    return schema;
  }

  private emitTuple(node: { kind: "tuple"; elements: { type: TypeNode; optional?: boolean; rest?: boolean }[] }): JSONSchema {
    const schema: JSONSchema = { type: "array" };

    const requiredCount = node.elements.filter(e => !e.optional && !e.rest).length;
    const hasRest = node.elements.some(e => e.rest);

    if (hasRest) {
      // Separate fixed elements and rest element
      const fixed = node.elements.filter(e => !e.rest);
      const rest = node.elements.find(e => e.rest);
      schema.prefixItems = fixed.map(e => this.emitType(e.type));
      schema.minItems = requiredCount;
      if (rest) {
        schema.items = this.emitType(rest.type);
      }
    } else {
      schema.prefixItems = node.elements.map(e => this.emitType(e.type));
      schema.minItems = requiredCount;
      schema.maxItems = node.elements.length;
    }

    return schema;
  }

  private emitUnion(members: TypeNode[]): JSONSchema {
    // Flatten nested unions
    const flat = this.flattenUnion(members);

    // Check if all members are string/number literals → use enum
    const allStringLiterals = flat.every(m => m.kind === "literal_string");
    if (allStringLiterals) {
      return {
        type: "string",
        enum: flat.map(m => (m as { kind: "literal_string"; value: string }).value),
      };
    }

    const allNumberLiterals = flat.every(m => m.kind === "literal_number");
    if (allNumberLiterals) {
      return {
        type: "number",
        enum: flat.map(m => (m as { kind: "literal_number"; value: number }).value),
      };
    }

    // Check for nullable: T | null → make T nullable
    const nullIndex = flat.findIndex(m => m.kind === "primitive" && m.value === "null");
    const undefinedIndex = flat.findIndex(m => m.kind === "primitive" && m.value === "undefined");
    const nonNullMembers = flat.filter(
      m => !(m.kind === "primitive" && (m.value === "null" || m.value === "undefined"))
    );

    if ((nullIndex !== -1 || undefinedIndex !== -1) && nonNullMembers.length === 1) {
      // Simple nullable: string | null
      const schema = this.emitType(nonNullMembers[0]);
      if (typeof schema.type === "string") {
        schema.type = [schema.type, "null"];
      } else {
        return { anyOf: [schema, { type: "null" }] };
      }
      return schema;
    }

    // General union → anyOf
    const schemas = flat.map(m => this.emitType(m));
    return { anyOf: schemas };
  }

  private flattenUnion(members: TypeNode[]): TypeNode[] {
    const result: TypeNode[] = [];
    for (const m of members) {
      if (m.kind === "union") {
        result.push(...this.flattenUnion(m.members));
      } else {
        result.push(m);
      }
    }
    return result;
  }

  private emitIntersection(members: TypeNode[]): JSONSchema {
    // If all members are objects, try to merge them
    const schemas = members.map(m => this.emitType(m));
    if (schemas.length === 1) return schemas[0];
    return { allOf: schemas };
  }

  private emitReference(node: { kind: "reference"; name: string; typeArgs?: TypeNode[] }): JSONSchema {
    // Handle built-in Date type
    if (node.name === "Date" && !node.typeArgs) {
      return { type: "string", format: "date-time" };
    }

    // Handle type arguments (generics and utility types)
    if (node.typeArgs && node.typeArgs.length > 0) {
      // First try utility types (Partial, Pick, Omit, etc.)
      const utilityResolved = this.resolveUtilityType(node.name, node.typeArgs);
      if (utilityResolved) return utilityResolved;

      // Try user-defined generic types
      const genericResolved = this.resolveGenericType(node.name, node.typeArgs);
      if (genericResolved) return genericResolved;
    }

    // If the declaration exists and is simple, we could inline it,
    // but using $ref is more correct and handles circular refs
    return { $ref: `#/$defs/${this.getDefineName(node.name)}` };
  }

  private emitRecord(keyType: TypeNode, valueType: TypeNode): JSONSchema {
    const schema: JSONSchema = { type: "object" };

    // If key is a union of string literals, emit explicit properties
    if (keyType.kind === "union") {
      const allStringLiterals = keyType.members.every(m => m.kind === "literal_string");
      if (allStringLiterals) {
        const valueSchema = this.emitType(valueType);
        schema.properties = {};
        schema.required = [];
        for (const m of keyType.members) {
          const key = (m as { kind: "literal_string"; value: string }).value;
          schema.properties[key] = { ...valueSchema };
          schema.required.push(key);
        }
        return schema;
      }
    }

    if (keyType.kind === "literal_string") {
      const valueSchema = this.emitType(valueType);
      schema.properties = { [keyType.value]: valueSchema };
      schema.required = [keyType.value];
      return schema;
    }

    // General Record<string, V>
    schema.additionalProperties = this.emitType(valueType);
    return schema;
  }

  // ---------------------------------------------------------------------------
  // Generic Type Instantiation
  // ---------------------------------------------------------------------------

  /**
   * Recursively substitute type parameters (like T, U) with actual type arguments
   */
  private substituteTypeParams(typeNode: TypeNode, paramMap: Map<string, TypeNode>): TypeNode {
    switch (typeNode.kind) {
      case "reference":
        // Check if this reference IS a type parameter (e.g., "T")
        if (paramMap.has(typeNode.name)) {
          return paramMap.get(typeNode.name)!;
        }
        // Recursively substitute in nested type arguments
        if (typeNode.typeArgs) {
          return {
            ...typeNode,
            typeArgs: typeNode.typeArgs.map(arg => this.substituteTypeParams(arg, paramMap))
          };
        }
        return typeNode;

      case "array":
        return {
          ...typeNode,
          element: this.substituteTypeParams(typeNode.element, paramMap)
        };

      case "object":
        return {
          ...typeNode,
          properties: typeNode.properties.map(prop => ({
            ...prop,
            type: this.substituteTypeParams(prop.type, paramMap)
          })),
          indexSignature: typeNode.indexSignature ? {
            keyType: this.substituteTypeParams(typeNode.indexSignature.keyType, paramMap),
            valueType: this.substituteTypeParams(typeNode.indexSignature.valueType, paramMap)
          } : undefined
        };

      case "union":
        return {
          ...typeNode,
          members: typeNode.members.map(m => this.substituteTypeParams(m, paramMap))
        };

      case "intersection":
        return {
          ...typeNode,
          members: typeNode.members.map(m => this.substituteTypeParams(m, paramMap))
        };

      case "tuple":
        return {
          ...typeNode,
          elements: typeNode.elements.map(e => ({
            ...e,
            type: this.substituteTypeParams(e.type, paramMap)
          }))
        };

      case "record":
        return {
          ...typeNode,
          keyType: this.substituteTypeParams(typeNode.keyType, paramMap),
          valueType: this.substituteTypeParams(typeNode.valueType, paramMap)
        };

      case "parenthesized":
        return {
          ...typeNode,
          inner: this.substituteTypeParams(typeNode.inner, paramMap)
        };

      // Primitives and literals don't contain type parameters
      default:
        return typeNode;
    }
  }

  /**
   * Instantiate a generic interface with concrete type arguments
   */
  private instantiateInterface(decl: InterfaceDeclaration, typeArgs: TypeNode[]): JSONSchema {
    // Build type parameter mapping
    // LIMITATION: We assume conventional param names (T, U, V, W)
    // since we don't parse type parameter declarations yet
    const typeParamMap = new Map<string, TypeNode>();
    const paramNames = ['T', 'U', 'V', 'W'];
    for (let i = 0; i < Math.min(typeArgs.length, paramNames.length); i++) {
      typeParamMap.set(paramNames[i], typeArgs[i]);
    }

    // Substitute type parameters in all properties
    const instantiatedProps = decl.properties.map(prop => ({
      ...prop,
      type: this.substituteTypeParams(prop.type, typeParamMap)
    }));

    // Substitute in index signature if present
    let instantiatedIndexSig: IndexSignatureNode | undefined;
    if (decl.indexSignature) {
      instantiatedIndexSig = {
        keyType: this.substituteTypeParams(decl.indexSignature.keyType, typeParamMap),
        valueType: this.substituteTypeParams(decl.indexSignature.valueType, typeParamMap)
      };
    }

    // Handle extends clause with substitution
    let extendsTypes: TypeNode[] | undefined;
    if (decl.extends) {
      extendsTypes = decl.extends.map(ext =>
        this.substituteTypeParams(ext, typeParamMap)
      );
    }

    // Emit the instantiated object type
    const schema = this.emitObjectType(instantiatedProps, instantiatedIndexSig, decl.tags);

    // If interface extends other types, use allOf
    if (extendsTypes && extendsTypes.length > 0) {
      const allOf: JSONSchema[] = extendsTypes.map(ext => this.emitType(ext));
      allOf.push(schema);
      return { allOf };
    }

    return schema;
  }

  /**
   * Instantiate a generic type alias with concrete type arguments
   */
  private instantiateTypeAlias(decl: TypeAliasDeclaration, typeArgs: TypeNode[]): JSONSchema {
    // Build type parameter mapping (same as interface)
    const typeParamMap = new Map<string, TypeNode>();
    const paramNames = ['T', 'U', 'V', 'W'];
    for (let i = 0; i < Math.min(typeArgs.length, paramNames.length); i++) {
      typeParamMap.set(paramNames[i], typeArgs[i]);
    }

    // Substitute type parameters in the aliased type
    const instantiatedType = this.substituteTypeParams(decl.type, typeParamMap);

    // Emit the instantiated type
    return this.emitType(instantiatedType);
  }

  /**
   * Look up a generic declaration and instantiate it with type arguments
   */
  private resolveGenericType(name: string, typeArgs: TypeNode[]): JSONSchema | null {
    // Look up the declaration in our declarations map
    const decl = this.declarations.get(name);
    if (!decl) {
      return null; // Generic not found, caller will fall back to $ref
    }

    // Instantiate based on declaration kind
    if (decl.kind === "interface") {
      return this.instantiateInterface(decl, typeArgs);
    } else if (decl.kind === "type_alias") {
      return this.instantiateTypeAlias(decl, typeArgs);
    }

    // Enums don't support type parameters
    return null;
  }

  // ---------------------------------------------------------------------------
  // Utility type resolution
  // ---------------------------------------------------------------------------

  private resolveUtilityType(name: string, typeArgs: TypeNode[]): JSONSchema | null {
    switch (name) {
      case "Partial":
        return this.resolvePartial(typeArgs[0]);
      case "Required":
        return this.resolveRequired(typeArgs[0]);
      case "Pick":
        if (typeArgs.length === 2) return this.resolvePick(typeArgs[0], typeArgs[1]);
        return null;
      case "Omit":
        if (typeArgs.length === 2) return this.resolveOmit(typeArgs[0], typeArgs[1]);
        return null;
      case "Readonly":
        return this.emitType(typeArgs[0]); // Schema doesn't enforce readonly
      case "NonNullable":
        return this.emitType(typeArgs[0]); // Already non-null in JSON
      case "Set":
        return { type: "array", items: this.emitType(typeArgs[0]), uniqueItems: true };
      case "Map":
        if (typeArgs.length === 2) {
          return { type: "object", additionalProperties: this.emitType(typeArgs[1]) };
        }
        return null;
      default:
        return null;
    }
  }

  private resolvePartial(target: TypeNode): JSONSchema {
    // For references, look up the declaration and make all properties optional
    if (target.kind === "reference") {
      const decl = this.declarations.get(target.name);
      if (decl && (decl.kind === "interface" || (decl.kind === "type_alias" && decl.type.kind === "object"))) {
        const props = decl.kind === "interface" ? decl.properties : (decl.type as any).properties;
        const schema = this.emitObjectType(
          props.map((p: PropertyNode) => ({ ...p, optional: true }))
        );
        return schema;
      }
    }

    // For inline objects
    if (target.kind === "object") {
      return this.emitObjectType(
        target.properties.map(p => ({ ...p, optional: true }))
      );
    }

    // Fallback: emit as-is
    return this.emitType(target);
  }

  private resolveRequired(target: TypeNode): JSONSchema {
    if (target.kind === "reference") {
      const decl = this.declarations.get(target.name);
      if (decl && (decl.kind === "interface" || (decl.kind === "type_alias" && decl.type.kind === "object"))) {
        const props = decl.kind === "interface" ? decl.properties : (decl.type as any).properties;
        return this.emitObjectType(
          props.map((p: PropertyNode) => ({ ...p, optional: false }))
        );
      }
    }

    if (target.kind === "object") {
      return this.emitObjectType(
        target.properties.map(p => ({ ...p, optional: false }))
      );
    }

    return this.emitType(target);
  }

  private resolvePick(target: TypeNode, keys: TypeNode): JSONSchema {
    const keyNames = this.extractKeyNames(keys);
    if (!keyNames) return this.emitType(target);

    const props = this.getProperties(target);
    if (!props) return this.emitType(target);

    return this.emitObjectType(
      props.filter(p => keyNames.has(p.name))
    );
  }

  private resolveOmit(target: TypeNode, keys: TypeNode): JSONSchema {
    const keyNames = this.extractKeyNames(keys);
    if (!keyNames) return this.emitType(target);

    const props = this.getProperties(target);
    if (!props) return this.emitType(target);

    return this.emitObjectType(
      props.filter(p => !keyNames.has(p.name))
    );
  }

  private extractKeyNames(node: TypeNode): Set<string> | null {
    if (node.kind === "literal_string") return new Set([node.value]);
    if (node.kind === "union") {
      const names = new Set<string>();
      for (const m of node.members) {
        if (m.kind === "literal_string") names.add(m.value);
        else return null;
      }
      return names;
    }
    return null;
  }

  private getProperties(node: TypeNode): PropertyNode[] | null {
    if (node.kind === "object") return node.properties;
    if (node.kind === "reference") {
      const decl = this.declarations.get(node.name);
      if (!decl) return null;
      if (decl.kind === "interface") return decl.properties;
      if (decl.kind === "type_alias" && decl.type.kind === "object") return decl.type.properties;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // JSDoc tag application
  // ---------------------------------------------------------------------------

  private applyJSDocTags(schema: JSONSchema, tags: Record<string, string>): void {
    for (const [key, value] of Object.entries(tags)) {
      switch (key) {
        case "minimum": schema.minimum = Number(value); break;
        case "maximum": schema.maximum = Number(value); break;
        case "minLength": schema.minLength = Number(value); break;
        case "maxLength": schema.maxLength = Number(value); break;
        case "pattern": schema.pattern = value; break;
        case "format": schema.format = value; break;
        case "default":
          try { schema.default = JSON.parse(value); }
          catch { schema.default = value; }
          break;
        case "example":
        case "examples":
          try {
            if (!schema.examples) schema.examples = [];
            schema.examples.push(JSON.parse(value));
          } catch {
            if (!schema.examples) schema.examples = [];
            schema.examples.push(value);
          }
          break;
        case "deprecated": schema.deprecated = true; break;
        case "title": schema.title = value; break;
        case "additionalProperties":
          // Only apply to object types
          if (schema.type === "object") {
            const lowerValue = value.toLowerCase();
            if (lowerValue === "true") {
              schema.additionalProperties = true;
            } else if (lowerValue === "false") {
              schema.additionalProperties = false;
            }
          }
          break;
      }
    }
  }
}
