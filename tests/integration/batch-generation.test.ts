import { describe, it, expect } from '@jest/globals';
import { toJsonSchemas } from '../../src/index.js';

describe('toJsonSchemas - batch generation', () => {
  it('should generate schemas for all types in one pass', () => {
    const source = `
      export interface User {
        id: string;
        name: string;
      }

      export interface Post {
        id: string;
        title: string;
        author: User;
      }
    `;

    const schemas = toJsonSchemas(source);

    expect(Object.keys(schemas).sort()).toEqual(['Post', 'User']);

    // User schema should be standalone
    expect(schemas.User).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id', 'name'],
      definitions: {}
    });

    // Post schema should include User in definitions
    expect(schemas.Post).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        author: { $ref: '#/definitions/User' }
      },
      required: ['id', 'title', 'author'],
      definitions: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        }
      }
    });
  });

  it('should handle transitive references', () => {
    const source = `
      export interface Address {
        street: string;
      }

      export interface User {
        name: string;
        address: Address;
      }

      export interface Post {
        title: string;
        author: User;
      }
    `;

    const schemas = toJsonSchemas(source);

    // Post should include both User and Address in definitions
    expect(Object.keys(schemas.Post.definitions).sort()).toEqual(['Address', 'User']);

    // Verify Address is properly included
    expect(schemas.Post.definitions.Address).toEqual({
      type: 'object',
      properties: {
        street: { type: 'string' }
      },
      required: ['street']
    });

    // Verify User references Address with correct path
    expect(schemas.Post.definitions.User).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: { $ref: '#/definitions/Address' }
      },
      required: ['name', 'address']
    });
  });

  it('should handle recursive types', () => {
    const source = `
      export interface TreeNode {
        value: number;
        children: TreeNode[];
      }
    `;

    const schemas = toJsonSchemas(source);

    // TreeNode should include itself in definitions
    expect(schemas.TreeNode.definitions.TreeNode).toBeDefined();
    expect(schemas.TreeNode.definitions.TreeNode).toEqual({
      type: 'object',
      properties: {
        value: { type: 'number' },
        children: {
          type: 'array',
          items: { $ref: '#/definitions/TreeNode' }
        }
      },
      required: ['value', 'children']
    });
  });

  it('should handle mutual references', () => {
    const source = `
      export interface Author {
        name: string;
        posts: Post[];
      }

      export interface Post {
        title: string;
        author: Author;
      }
    `;

    const schemas = toJsonSchemas(source);

    // Both schemas should include both types in their definitions
    expect(Object.keys(schemas.Author.definitions).sort()).toEqual(['Author', 'Post']);
    expect(Object.keys(schemas.Post.definitions).sort()).toEqual(['Author', 'Post']);
  });

  it('should not duplicate definitions for types not in source', () => {
    const source = `
      export interface Shared { id: string; }
      export interface A { shared: Shared; }
      export interface B { shared: Shared; }
    `;

    const schemas = toJsonSchemas(source);

    // Both A and B should have Shared in definitions
    expect(schemas.A.definitions.Shared).toBeDefined();
    expect(schemas.B.definitions.Shared).toBeDefined();

    // But Shared itself should not have Shared in its definitions
    expect(schemas.Shared.definitions.Shared).toBeUndefined();
    expect(schemas.Shared.definitions).toEqual({});
  });

  it('should respect includeJSDoc option', () => {
    const source = `
      /**
       * User model
       * @additionalProperties false
       */
      export interface User {
        /** User ID */
        id: string;
      }
    `;

    const withJSDoc = toJsonSchemas(source, { includeJSDoc: true });
    expect(withJSDoc.User.description).toBe('User model');
    expect(withJSDoc.User.properties.id.description).toBe('User ID');
    expect(withJSDoc.User.additionalProperties).toBe(false);

    const withoutJSDoc = toJsonSchemas(source, { includeJSDoc: false });
    expect(withoutJSDoc.User.description).toBeUndefined();
    expect(withoutJSDoc.User.properties.id.description).toBeUndefined();
    expect(withoutJSDoc.User.additionalProperties).toBeUndefined();
  });

  it('should handle utility types', () => {
    const source = `
      export interface User {
        id: string;
        name: string;
        email: string;
      }

      export type UserPartial = Partial<User>;
      export type UserPick = Pick<User, 'id' | 'name'>;
    `;

    const schemas = toJsonSchemas(source);

    // UserPartial should have all properties optional
    expect(schemas.UserPartial.required).toBeUndefined();
    expect(Object.keys(schemas.UserPartial.properties).sort()).toEqual(['email', 'id', 'name']);

    // UserPick should only have picked properties
    expect(Object.keys(schemas.UserPick.properties).sort()).toEqual(['id', 'name']);
    expect(schemas.UserPick.required).toEqual(['id', 'name']);
  });

  it('should handle enums', () => {
    const source = `
      export enum Status {
        Active = "active",
        Inactive = "inactive"
      }

      export interface User {
        status: Status;
      }
    `;

    const schemas = toJsonSchemas(source);

    // User schema should include Status in definitions
    expect(schemas.User.definitions.Status).toEqual({
      type: 'string',
      enum: ['active', 'inactive']
    });
  });

  it('should handle built-in types without adding them to definitions', () => {
    const source = `
      export interface User {
        createdAt: Date;
        tags: Set<string>;
        metadata: Map<string, string>;
      }
    `;

    const schemas = toJsonSchemas(source);

    // Built-in types should not appear in definitions
    expect(schemas.User.definitions.Date).toBeUndefined();
    expect(schemas.User.definitions.Set).toBeUndefined();
    expect(schemas.User.definitions.Map).toBeUndefined();

    // They should be converted inline
    expect(schemas.User.properties.createdAt).toEqual({
      type: 'string',
      format: 'date-time'
    });
    expect(schemas.User.properties.tags).toEqual({
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true
    });
    expect(schemas.User.properties.metadata).toEqual({
      type: 'object',
      additionalProperties: { type: 'string' }
    });
  });

  it('should handle unexported types', () => {
    const source = `
      interface Internal {
        secret: string;
      }

      export interface Public {
        data: Internal;
      }
    `;

    const schemas = toJsonSchemas(source);

    // Internal should still be included in Public's definitions
    expect(schemas.Public.definitions.Internal).toEqual({
      type: 'object',
      properties: {
        secret: { type: 'string' }
      },
      required: ['secret']
    });
  });

  it('should handle unions and intersections', () => {
    const source = `
      export interface Base {
        id: string;
      }

      export interface Named {
        name: string;
      }

      export type User = Base & Named;
      export type Status = "active" | "inactive";
    `;

    const schemas = toJsonSchemas(source);

    // User should include both Base and Named in definitions
    expect(Object.keys(schemas.User.definitions).sort()).toEqual(['Base', 'Named']);

    // Status should not have any definitions (it's a simple union of literals)
    expect(schemas.Status.definitions).toEqual({});
  });

  it('should handle type aliases to primitives', () => {
    const source = `
      export type UserID = string;
      export type Age = number;
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.UserID).toEqual({
      type: 'string',
      definitions: {}
    });

    expect(schemas.Age).toEqual({
      type: 'number',
      definitions: {}
    });
  });

  it('should handle complex nested structures', () => {
    const source = `
      export interface Config {
        database: {
          host: string;
          port: number;
        };
      }

      export interface App {
        config: Config;
      }
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.App.definitions.Config).toBeDefined();
    expect(schemas.App.definitions.Config.properties.database).toEqual({
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'number' }
      },
      required: ['host', 'port']
    });
  });

  it('should handle optional properties and readonly modifiers', () => {
    const source = `
      export interface User {
        readonly id: string;
        name: string;
        email?: string;
      }

      export interface Post {
        user: User;
      }
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.Post.definitions.User).toEqual({
      type: 'object',
      properties: {
        id: { type: 'string', readOnly: true },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name']
    });
  });

  it('should handle arrays of referenced types', () => {
    const source = `
      export interface Tag {
        name: string;
      }

      export interface Post {
        tags: Tag[];
      }
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.Post.properties.tags).toEqual({
      type: 'array',
      items: { $ref: '#/definitions/Tag' }
    });

    expect(schemas.Post.definitions.Tag).toEqual({
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    });
  });

  it('should respect strictObjects option', () => {
    const source = `
      export interface User {
        id: string;
      }
    `;

    const withStrict = toJsonSchemas(source, { strictObjects: true });
    expect(withStrict.User.additionalProperties).toBe(false);

    const withoutStrict = toJsonSchemas(source, { strictObjects: false });
    expect(withoutStrict.User.additionalProperties).toBeUndefined();
  });

  it('should respect additionalProperties option', () => {
    const source = `
      export interface User {
        id: string;
      }
    `;

    const withTrue = toJsonSchemas(source, { additionalProperties: true });
    expect(withTrue.User.additionalProperties).toBe(true);

    const withFalse = toJsonSchemas(source, { additionalProperties: false });
    expect(withFalse.User.additionalProperties).toBe(false);
  });

  it('should handle interface extends', () => {
    const source = `
      export interface Base {
        id: string;
      }

      export interface User extends Base {
        name: string;
      }
    `;

    const schemas = toJsonSchemas(source);

    // User should include Base in definitions
    expect(schemas.User.definitions.Base).toBeDefined();

    // User schema should use allOf
    expect(schemas.User.allOf).toBeDefined();
    expect(schemas.User.allOf).toHaveLength(2);
    expect(schemas.User.allOf[0]).toEqual({ $ref: '#/definitions/Base' });
  });

  it('should handle Record utility type', () => {
    const source = `
      export interface User {
        name: string;
      }

      export type UserMap = Record<string, User>;
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.UserMap.definitions.User).toBeDefined();
    expect(schemas.UserMap.type).toBe('object');
    expect(schemas.UserMap.additionalProperties).toEqual({ $ref: '#/definitions/User' });
  });

  it('should handle tuples', () => {
    const source = `
      export interface User {
        id: string;
      }

      export type UserPair = [User, User];
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.UserPair.definitions.User).toBeDefined();
    expect(schemas.UserPair.type).toBe('array');
    expect(schemas.UserPair.prefixItems).toHaveLength(2);
    expect(schemas.UserPair.prefixItems[0]).toEqual({ $ref: '#/definitions/User' });
  });

  it('should handle index signatures', () => {
    const source = `
      export interface StringMap {
        [key: string]: string;
      }

      export interface User {
        id: string;
      }

      export interface UserMap {
        [key: string]: User;
      }
    `;

    const schemas = toJsonSchemas(source);

    expect(schemas.StringMap.additionalProperties).toEqual({ type: 'string' });
    expect(schemas.UserMap.additionalProperties).toEqual({ $ref: '#/definitions/User' });
    expect(schemas.UserMap.definitions.User).toBeDefined();
  });
});
