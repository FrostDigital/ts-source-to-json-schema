import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Arrays and Tuples', () => {
  describe('Array syntax', () => {
    it('should convert array shorthand T[]', () => {
      const schema = toJsonSchema(`
        type Tags = string[];
      `, { rootType: 'Tags', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string' },
      });
    });

    it('should convert Array<T> generic', () => {
      const schema = toJsonSchema(`
        type Numbers = Array<number>;
      `, { rootType: 'Numbers', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'number' },
      });
    });

    it('should handle nested arrays', () => {
      const schema = toJsonSchema(`
        type Matrix = number[][];
      `, { rootType: 'Matrix', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' },
        },
      });
    });

    it('should handle array of complex types', () => {
      const schema = toJsonSchema(`
        interface Item {
          id: string;
        }
        type Items = Item[];
      `, { rootType: 'Items', includeSchema: false });

      expect(schema.type).toBe('array');
      expect(schema.items).toEqual({ $ref: '#/$defs/Item' });
      // $defs are included automatically
      expect(schema.$defs?.Item).toBeDefined();
    });
  });

  describe('Tuples', () => {
    it('should convert basic tuple', () => {
      const schema = toJsonSchema(`
        type Pair = [string, number];
      `, { rootType: 'Pair', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        prefixItems: [
          { type: 'string' },
          { type: 'number' },
        ],
        minItems: 2,
        maxItems: 2,
      });
    });

    it('should handle single element tuple', () => {
      const schema = toJsonSchema(`
        type Single = [string];
      `, { rootType: 'Single', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        prefixItems: [{ type: 'string' }],
        minItems: 1,
        maxItems: 1,
      });
    });

    it('should handle tuples with multiple types', () => {
      const schema = toJsonSchema(`
        type Triple = [string, number, boolean];
      `, { rootType: 'Triple', includeSchema: false });

      expect(schema.prefixItems).toHaveLength(3);
      expect(schema.minItems).toBe(3);
      expect(schema.maxItems).toBe(3);
    });
  });

  describe('Set type', () => {
    it('should convert Set<T> to array with uniqueItems', () => {
      const schema = toJsonSchema(`
        type UniqueStrings = Set<string>;
      `, { rootType: 'UniqueStrings', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
      });
    });
  });
});
