import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('JSDoc Configuration', () => {
  it('should include JSDoc when includeJSDoc is true (default)', () => {
    const schema = toJsonSchema(`
      /** User interface */
      interface User {
        /** User's name */
        name: string;
      }
    `, { rootType: 'User', includeSchema: false });

    expect(schema.description).toBe('User interface');
    expect(schema.properties?.name.description).toBe("User's name");
  });

  it('should exclude JSDoc when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      /** User interface */
      interface User {
        /** User's name */
        name: string;
      }
    `, { rootType: 'User', includeSchema: false, includeJSDoc: false });

    expect(schema.description).toBeUndefined();
    expect(schema.properties?.name.description).toBeUndefined();
  });

  it('should exclude JSDoc tags when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      interface User {
        /**
         * User age
         * @minimum 0
         * @maximum 150
         */
        age: number;
      }
    `, { rootType: 'User', includeSchema: false, includeJSDoc: false });

    expect(schema.properties?.age.description).toBeUndefined();
    expect(schema.properties?.age.minimum).toBeUndefined();
    expect(schema.properties?.age.maximum).toBeUndefined();
    expect(schema.properties?.age.type).toBe('number'); // Still has type
  });

  it('should handle includeJSDoc with other options', () => {
    const schema = toJsonSchema(`
      /** Config interface */
      interface Config {
        /** Host name */
        host: string;
      }
    `, {
      rootType: 'Config',
      includeSchema: true,
      includeJSDoc: false,
      strictObjects: true
    });

    expect(schema.$schema).toBeDefined();
    expect(schema.description).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
  });

  it('should exclude JSDoc from type aliases when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      /** User ID type */
      type UserId = string;
    `, { rootType: 'UserId', includeSchema: false, includeJSDoc: false });

    expect(schema.description).toBeUndefined();
    expect(schema.type).toBe('string');
  });

  it('should exclude JSDoc from enums when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      /** User status enum */
      enum Status {
        Active = "active",
        Inactive = "inactive"
      }
    `, { rootType: 'Status', includeSchema: false, includeJSDoc: false });

    expect(schema.description).toBeUndefined();
    expect(schema.enum).toEqual(['active', 'inactive']);
  });

  it('should exclude all JSDoc constraint tags when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      interface Product {
        /**
         * Product name
         * @minLength 1
         * @maxLength 100
         * @pattern ^[A-Z]
         */
        name: string;
        /**
         * Price in cents
         * @minimum 0
         * @maximum 999999
         * @default 0
         */
        price: number;
        /**
         * Created date
         * @format date-time
         */
        createdAt: string;
        /**
         * Old field
         * @deprecated Use newField instead
         */
        oldField: string;
        /**
         * Example field
         * @example "test"
         */
        exampleField: string;
      }
    `, { rootType: 'Product', includeSchema: false, includeJSDoc: false });

    // Name - no string constraints
    expect(schema.properties?.name.description).toBeUndefined();
    expect(schema.properties?.name.minLength).toBeUndefined();
    expect(schema.properties?.name.maxLength).toBeUndefined();
    expect(schema.properties?.name.pattern).toBeUndefined();

    // Price - no number constraints
    expect(schema.properties?.price.description).toBeUndefined();
    expect(schema.properties?.price.minimum).toBeUndefined();
    expect(schema.properties?.price.maximum).toBeUndefined();
    expect(schema.properties?.price.default).toBeUndefined();

    // CreatedAt - no format
    expect(schema.properties?.createdAt.description).toBeUndefined();
    expect(schema.properties?.createdAt.format).toBeUndefined();

    // OldField - no deprecated
    expect(schema.properties?.oldField.description).toBeUndefined();
    expect(schema.properties?.oldField.deprecated).toBeUndefined();

    // ExampleField - no examples
    expect(schema.properties?.exampleField.description).toBeUndefined();
    expect(schema.properties?.exampleField.examples).toBeUndefined();

    // But structural information remains
    expect(schema.type).toBe('object');
    expect(schema.properties?.name.type).toBe('string');
    expect(schema.properties?.price.type).toBe('number');
  });

  it('should preserve readonly flag even when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      interface User {
        /** User ID */
        readonly id: string;
      }
    `, { rootType: 'User', includeSchema: false, includeJSDoc: false });

    expect(schema.properties?.id.description).toBeUndefined();
    expect(schema.properties?.id.readOnly).toBe(true);
  });

  it('should exclude JSDoc from interface extends when includeJSDoc is false', () => {
    const schema = toJsonSchema(`
      interface Base {
        id: string;
      }
      /** Extended user interface */
      interface User extends Base {
        name: string;
      }
    `, { rootType: 'User', includeSchema: false, includeJSDoc: false });

    expect(schema.description).toBeUndefined();
    expect(schema.allOf).toBeDefined();
  });
});
