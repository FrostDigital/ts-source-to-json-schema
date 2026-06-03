import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Unions and Literal Types', () => {
  describe('String literal unions', () => {
    it('should convert string literal union to enum', () => {
      const schema = toJsonSchema(`
        type Status = "active" | "inactive" | "pending";
      `, { rootType: 'Status', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
      });
    });

    it('should handle single string literal', () => {
      const schema = toJsonSchema(`
        type Constant = "FIXED_VALUE";
      `, { rootType: 'Constant', includeSchema: false });

      // Single literal is represented as const, not enum
      expect(schema).toEqual({
        const: 'FIXED_VALUE',
      });
    });
  });

  describe('Number literal unions', () => {
    it('should convert number literal union to enum', () => {
      const schema = toJsonSchema(`
        type HttpCode = 200 | 404 | 500;
      `, { rootType: 'HttpCode', includeSchema: false });

      expect(schema).toEqual({
        type: 'number',
        enum: [200, 404, 500],
      });
    });

    it('should handle negative numbers', () => {
      const schema = toJsonSchema(`
        type Temperature = -10 | 0 | 10 | 20;
      `, { rootType: 'Temperature', includeSchema: false });

      expect(schema).toEqual({
        type: 'number',
        enum: [-10, 0, 10, 20],
      });
    });
  });

  describe('Boolean literal unions', () => {
    it('should handle boolean literals', () => {
      const schema = toJsonSchema(`
        type TrueOnly = true;
      `, { rootType: 'TrueOnly', includeSchema: false });

      // Single literal is represented as const
      expect(schema).toEqual({
        const: true,
      });
    });
  });

  describe('Mixed unions', () => {
    it('should convert mixed union to anyOf', () => {
      const schema = toJsonSchema(`
        type Value = string | number | boolean;
      `, { rootType: 'Value', includeSchema: false });

      expect(schema).toEqual({
        anyOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
        ],
      });
    });

    it('should handle complex mixed union', () => {
      const schema = toJsonSchema(`
        type ComplexValue = string | number | { id: string };
      `, { rootType: 'ComplexValue', includeSchema: false });

      expect(schema.anyOf).toBeDefined();
      expect(schema.anyOf).toHaveLength(3);
    });
  });

  describe('Nullable types', () => {
    it('should handle string | null', () => {
      const schema = toJsonSchema(`
        type MaybeString = string | null;
      `, { rootType: 'MaybeString', includeSchema: false });

      expect(schema).toEqual({
        type: ['string', 'null'],
      });
    });

    it('should handle number | null', () => {
      const schema = toJsonSchema(`
        type MaybeNumber = number | null;
      `, { rootType: 'MaybeNumber', includeSchema: false });

      expect(schema).toEqual({
        type: ['number', 'null'],
      });
    });

    it('should handle string | undefined', () => {
      const schema = toJsonSchema(`
        type MaybeUndefined = string | undefined;
      `, { rootType: 'MaybeUndefined', includeSchema: false });

      // undefined might be handled differently
      expect(schema.type || schema.anyOf).toBeDefined();
    });
  });

  describe('Leading pipe syntax', () => {
    it('should handle leading pipe in union', () => {
      const schema = toJsonSchema(`
        type Status = | "active" | "inactive";
      `, { rootType: 'Status', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['active', 'inactive'],
      });
    });
  });

  describe('Interspersed JSDoc comments (issue #78)', () => {
    it('should not drop union members after an interspersed JSDoc comment', () => {
      const schema = toJsonSchema(`
        export type Status =
          | "a"
          | "b"
          /**
           * This doc comment must not break generation.
           */
          | "c"
          | "d";
      `, { rootType: 'Status', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['a', 'b', 'c', 'd'],
      });
    });

    it('should handle a JSDoc comment before every member', () => {
      const schema = toJsonSchema(`
        export type Status =
          /** first */
          | "a"
          /** second */
          | "b"
          /** third */
          | "c";
      `, { rootType: 'Status', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['a', 'b', 'c'],
      });
    });

    it('should keep object union members separated by JSDoc comments', () => {
      const schema = toJsonSchema(`
        export type Shape =
          | { kind: "circle" }
          /** a square */
          | { kind: "square" };
      `, { rootType: 'Shape', includeSchema: false });

      expect(schema.anyOf).toHaveLength(2);
    });

    it('should not consume the type alias JSDoc as a member doc', () => {
      const schema = toJsonSchema(`
        /** This documents the alias itself */
        export type Status = "a" | "b";
      `, { rootType: 'Status', includeSchema: false });

      expect(schema).toEqual({
        type: 'string',
        enum: ['a', 'b'],
        description: 'This documents the alias itself',
      });
    });
  });
});
