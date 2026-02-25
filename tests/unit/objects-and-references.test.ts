import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Objects and References', () => {
  describe('Nested inline objects', () => {
    it('should handle nested object properties', () => {
      const schema = toJsonSchema(`
        interface Order {
          id: string;
          shipping: {
            address: string;
            city: string;
            zip: string;
          };
        }
      `, { rootType: 'Order', includeSchema: false });

      expect(schema.properties?.shipping).toEqual({
        type: 'object',
        properties: {
          address: { type: 'string' },
          city: { type: 'string' },
          zip: { type: 'string' },
        },
        required: ['address', 'city', 'zip'],
      });
    });

    it('should handle deeply nested objects', () => {
      const schema = toJsonSchema(`
        interface Deep {
          level1: {
            level2: {
              level3: string;
            };
          };
        }
      `, { rootType: 'Deep', includeSchema: false });

      expect(schema.properties?.level1.type).toBe('object');
      expect(schema.properties?.level1.properties?.level2.type).toBe('object');
      expect(schema.properties?.level1.properties?.level2.properties?.level3).toEqual({ type: 'string' });
    });
  });

  describe('Type references', () => {
    it('should create $ref for type references', () => {
      const schema = toJsonSchema(`
        interface Address {
          street: string;
          city: string;
        }
        interface User {
          name: string;
          address: Address;
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema.properties?.address).toEqual({ $ref: '#/$defs/Address' });
      expect(schema.$defs?.Address).toBeDefined();
      expect(schema.$defs?.Address.type).toBe('object');
    });

    it('should handle multiple type references', () => {
      const schema = toJsonSchema(`
        interface A { x: string; }
        interface B { y: number; }
        interface C {
          a: A;
          b: B;
        }
      `, { rootType: 'C', includeSchema: false });

      expect(schema.properties?.a).toEqual({ $ref: '#/$defs/A' });
      expect(schema.properties?.b).toEqual({ $ref: '#/$defs/B' });
      expect(schema.$defs?.A).toBeDefined();
      expect(schema.$defs?.B).toBeDefined();
    });
  });

  describe('Self-referential types', () => {
    it('should handle recursive type definitions', () => {
      const schema = toJsonSchema(`
        interface Task {
          title: string;
          subtasks?: Task[];
        }
      `, { rootType: 'Task', includeSchema: false });

      // Recursive types are now correctly handled by making root a $ref
      expect(schema.$ref).toBe('#/$defs/Task');
      expect(schema.$defs?.Task).toBeDefined();

      // Verify the Task definition is correct
      const taskDef = schema.$defs?.Task;
      expect(taskDef?.type).toBe('object');
      expect(taskDef?.properties?.title).toEqual({ type: 'string' });
      expect(taskDef?.properties?.subtasks).toEqual({
        type: 'array',
        items: { $ref: '#/$defs/Task' },
      });
    });
  });

  describe('Index signatures', () => {
    it('should convert index signature to additionalProperties', () => {
      const schema = toJsonSchema(`
        interface Dictionary {
          [key: string]: number;
        }
      `, { rootType: 'Dictionary', includeSchema: false });

      expect(schema).toEqual({
        type: 'object',
        additionalProperties: { type: 'number' },
      });
    });

    it('should combine properties with index signature', () => {
      const schema = toJsonSchema(`
        interface MixedDict {
          knownProp: string;
          [key: string]: string | number;
        }
      `, { rootType: 'MixedDict', includeSchema: false });

      expect(schema.properties?.knownProp).toBeDefined();
      expect(schema.additionalProperties).toBeDefined();
    });
  });

  describe('Empty interfaces', () => {
    it('should handle empty interface', () => {
      const schema = toJsonSchema(`
        interface Empty {}
      `, { rootType: 'Empty', includeSchema: false });

      expect(schema).toEqual({
        type: 'object',
      });
    });
  });
});
