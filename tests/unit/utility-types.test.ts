import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Utility Types', () => {
  describe('Partial<T>', () => {
    it('should make all properties optional', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string;
          age: number;
          email: string;
        }
        type PartialUser = Partial<User>;
      `, { rootType: 'PartialUser', includeSchema: false });

      expect(schema.type).toBe('object');
      expect(schema.required).toBeUndefined();
      expect(schema.properties).toBeDefined();
      expect(Object.keys(schema.properties!)).toHaveLength(3);
    });
  });

  describe('Required<T>', () => {
    it('should make all properties required', () => {
      const schema = toJsonSchema(`
        interface Config {
          host?: string;
          port?: number;
        }
        type RequiredConfig = Required<Config>;
      `, { rootType: 'RequiredConfig', includeSchema: false });

      expect(schema.required).toEqual(['host', 'port']);
    });
  });

  describe('Pick<T, K>', () => {
    it('should pick specific properties', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string;
          age: number;
          email: string;
          password: string;
        }
        type UserSummary = Pick<User, "name" | "email">;
      `, { rootType: 'UserSummary', includeSchema: false });

      expect(schema.properties?.name).toBeDefined();
      expect(schema.properties?.email).toBeDefined();
      expect(schema.properties?.age).toBeUndefined();
      expect(schema.properties?.password).toBeUndefined();
      expect(schema.required).toEqual(['name', 'email']);
    });
  });

  describe('Omit<T, K>', () => {
    it('should omit specific properties', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string;
          age: number;
          password: string;
        }
        type SafeUser = Omit<User, "password">;
      `, { rootType: 'SafeUser', includeSchema: false });

      expect(schema.properties?.name).toBeDefined();
      expect(schema.properties?.age).toBeDefined();
      expect(schema.properties?.password).toBeUndefined();
      expect(schema.required).toEqual(['name', 'age']);
    });

    it('should handle omitting multiple properties', () => {
      const schema = toJsonSchema(`
        interface Data {
          a: string;
          b: number;
          c: boolean;
          d: string;
        }
        type Reduced = Omit<Data, "b" | "d">;
      `, { rootType: 'Reduced', includeSchema: false });

      expect(Object.keys(schema.properties!)).toEqual(['a', 'c']);
    });
  });

  describe('Record<K, V>', () => {
    it('should create object with string keys', () => {
      const schema = toJsonSchema(`
        type Scores = Record<string, number>;
      `, { rootType: 'Scores', includeSchema: false });

      expect(schema).toEqual({
        type: 'object',
        additionalProperties: { type: 'number' },
      });
    });

    it('should handle Record with literal keys', () => {
      const schema = toJsonSchema(`
        type Config = Record<"host" | "port", string>;
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.properties?.host).toBeDefined();
      expect(schema.properties?.port).toBeDefined();
      expect(schema.required).toEqual(['host', 'port']);
    });

    it('should handle Record with complex value types', () => {
      const schema = toJsonSchema(`
        interface Item {
          id: string;
        }
        type Items = Record<string, Item>;
      `, { rootType: 'Items', includeSchema: false });

      expect(schema.additionalProperties).toEqual({ $ref: '#/$defs/Item' });
    });
  });

  describe('Readonly<T>', () => {
    it('should preserve readonly modifier', () => {
      const schema = toJsonSchema(`
        interface Config {
          readonly apiKey: string;
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.properties?.apiKey.readOnly).toBe(true);
    });
  });

  describe('Promise<T>', () => {
    it('should unwrap Promise type', () => {
      const schema = toJsonSchema(`
        type AsyncString = Promise<string>;
      `, { rootType: 'AsyncString', includeSchema: false });

      expect(schema).toEqual({ type: 'string' });
    });

    it('should unwrap nested Promise', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string;
        }
        type AsyncUser = Promise<User>;
      `, { rootType: 'AsyncUser', includeSchema: false });

      expect(schema.$ref).toBe('#/$defs/User');
      // $defs are included automatically
      expect(schema.$defs?.User).toBeDefined();
    });
  });

  describe('Map<K, V>', () => {
    it('should convert Map to object with additionalProperties', () => {
      const schema = toJsonSchema(`
        type StringMap = Map<string, number>;
      `, { rootType: 'StringMap', includeSchema: false });

      expect(schema).toEqual({
        type: 'object',
        additionalProperties: { type: 'number' },
      });
    });
  });
});
