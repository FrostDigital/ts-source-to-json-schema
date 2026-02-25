import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Primitive Types', () => {
  describe('Basic interface with primitives', () => {
    it('should convert string, number, and boolean properties', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string;
          age: number;
          active: boolean;
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          active: { type: 'boolean' },
        },
        required: ['name', 'age', 'active'],
      });
    });

    it('should handle all primitive types', () => {
      const schema = toJsonSchema(`
        interface AllPrimitives {
          str: string;
          num: number;
          bool: boolean;
          undef: undefined;
          nul: null;
          big: bigint;
        }
      `, { rootType: 'AllPrimitives', includeSchema: false });

      expect(schema.properties?.str).toEqual({ type: 'string' });
      expect(schema.properties?.num).toEqual({ type: 'number' });
      expect(schema.properties?.bool).toEqual({ type: 'boolean' });
      expect(schema.properties?.big).toEqual({ type: 'integer' });
    });
  });

  describe('Optional properties', () => {
    it('should only include non-optional properties in required array', () => {
      const schema = toJsonSchema(`
        interface Config {
          host: string;
          port?: number;
          debug?: boolean;
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.required).toEqual(['host']);
      expect(schema.properties?.port).toBeDefined();
      expect(schema.properties?.debug).toBeDefined();
    });

    it('should handle all optional properties', () => {
      const schema = toJsonSchema(`
        interface AllOptional {
          a?: string;
          b?: number;
        }
      `, { rootType: 'AllOptional', includeSchema: false });

      expect(schema.required).toBeUndefined();
      expect(schema.properties?.a).toEqual({ type: 'string' });
      expect(schema.properties?.b).toEqual({ type: 'number' });
    });
  });

  describe('Special types', () => {
    it('should handle any type', () => {
      const schema = toJsonSchema(`
        type AnyValue = any;
      `, { rootType: 'AnyValue', includeSchema: false });

      expect(schema).toEqual({});
    });

    it('should handle unknown type', () => {
      const schema = toJsonSchema(`
        type UnknownValue = unknown;
      `, { rootType: 'UnknownValue', includeSchema: false });

      expect(schema).toEqual({});
    });

    it('should handle never type', () => {
      const schema = toJsonSchema(`
        type NeverValue = never;
      `, { rootType: 'NeverValue', includeSchema: false });

      expect(schema).toEqual({ not: {} });
    });
  });
});
