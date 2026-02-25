import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Enums', () => {
  describe('String enums', () => {
    it('should convert string enum', () => {
      const schema = toJsonSchema(`
        enum Color {
          Red = "red",
          Green = "green",
          Blue = "blue",
        }
      `, { rootType: 'Color', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['red', 'green', 'blue'],
      });
    });

    it('should handle string enum with explicit values', () => {
      const schema = toJsonSchema(`
        enum Status {
          Active = "ACTIVE",
          Inactive = "INACTIVE",
        }
      `, { rootType: 'Status', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['ACTIVE', 'INACTIVE'],
      });
    });
  });

  describe('Numeric enums', () => {
    it('should convert numeric enum with auto-increment', () => {
      const schema = toJsonSchema(`
        enum Priority {
          Low,
          Medium,
          High,
        }
      `, { rootType: 'Priority', includeSchema: false });

      expect(schema).toEqual({
        type: 'number',
        enum: [0, 1, 2],
      });
    });

    it('should handle numeric enum with explicit values', () => {
      const schema = toJsonSchema(`
        enum HttpStatus {
          OK = 200,
          NotFound = 404,
          ServerError = 500,
        }
      `, { rootType: 'HttpStatus', includeSchema: false });

      expect(schema).toEqual({
        type: 'number',
        enum: [200, 404, 500],
      });
    });

    it('should handle numeric enum with starting value', () => {
      const schema = toJsonSchema(`
        enum Level {
          Basic = 1,
          Intermediate,
          Advanced,
        }
      `, { rootType: 'Level', includeSchema: false });

      expect(schema).toEqual({
        type: 'number',
        enum: [1, 2, 3],
      });
    });
  });

  describe('Enums with export', () => {
    it('should handle exported enums', () => {
      const schema = toJsonSchema(`
        export enum Color {
          Red = "red",
          Blue = "blue",
        }
      `, { rootType: 'Color', includeSchema: false });

      expect(schema.type).toBe('string');
      expect(schema.enum).toEqual(['red', 'blue']);
    });
  });
});
