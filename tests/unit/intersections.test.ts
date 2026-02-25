import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Intersection Types', () => {
  describe('Basic intersections', () => {
    it('should convert intersection to allOf', () => {
      const schema = toJsonSchema(`
        interface A {
          a: string;
        }
        interface B {
          b: number;
        }
        type C = A & B;
      `, { rootType: 'C', includeSchema: false });

      expect(schema.allOf).toBeDefined();
      expect(schema.allOf).toHaveLength(2);
      expect(schema.allOf).toContainEqual({ $ref: '#/$defs/A' });
      expect(schema.allOf).toContainEqual({ $ref: '#/$defs/B' });
    });

    it('should handle multiple intersections', () => {
      const schema = toJsonSchema(`
        type A = { a: string };
        type B = { b: number };
        type C = { c: boolean };
        type ABC = A & B & C;
      `, { rootType: 'ABC', includeSchema: false });

      expect(schema.allOf).toHaveLength(3);
    });
  });

  describe('Interface extends', () => {
    it('should handle interface extends with allOf', () => {
      const schema = toJsonSchema(`
        interface Animal {
          name: string;
        }
        interface Dog extends Animal {
          breed: string;
        }
      `, { rootType: 'Dog', includeSchema: false });

      expect(schema.allOf).toBeDefined();
      expect(schema.allOf).toContainEqual({ $ref: '#/$defs/Animal' });
    });

    it('should handle multiple interface extends', () => {
      const schema = toJsonSchema(`
        interface A { a: string; }
        interface B { b: number; }
        interface C extends A, B {
          c: boolean;
        }
      `, { rootType: 'C', includeSchema: false });

      expect(schema.allOf).toBeDefined();
      expect(schema.allOf.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Mixed intersections', () => {
    it('should handle inline object in intersection', () => {
      const schema = toJsonSchema(`
        interface Base {
          id: string;
        }
        type Extended = Base & { extra: number };
      `, { rootType: 'Extended', includeSchema: false });

      expect(schema.allOf).toBeDefined();
      expect(schema.allOf.length).toBeGreaterThanOrEqual(1);
    });
  });
});
