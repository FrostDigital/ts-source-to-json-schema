import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Complex Real-World Scenarios', () => {
  describe('API schemas', () => {
    it('should handle agent tool schema', () => {
      const schema = toJsonSchema(`
        /** Input for the ad analysis tool */
        interface AnalyzeAdInput {
          /** URL of the ad to analyze */
          url: string;
          /** Platform the ad is from */
          platform: "instagram" | "facebook" | "tiktok";
          /** Whether to extract color palette */
          extractColors?: boolean;
          /**
           * Max elements to identify
           * @minimum 1
           * @maximum 50
           * @default 10
           */
          maxElements?: number;
          tags: string[];
        }
      `, { rootType: 'AnalyzeAdInput', includeSchema: false });

      expect(schema.type).toBe('object');
      expect(schema.description).toContain('ad analysis tool');
      expect(schema.properties?.platform.enum).toEqual(['instagram', 'facebook', 'tiktok']);
      expect(schema.properties?.maxElements.minimum).toBe(1);
      expect(schema.properties?.maxElements.maximum).toBe(50);
      expect(schema.properties?.maxElements.default).toBe(10);
      expect(schema.required).toEqual(['url', 'platform', 'tags']);
    });

    it('should handle multi-type file with cross-references', () => {
      const schema = toJsonSchema(`
        interface Address {
          street: string;
          city: string;
          country: string;
        }

        interface Contact {
          email: string;
          phone?: string;
        }

        interface User {
          id: string;
          name: string;
          address: Address;
          contacts: Contact[];
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema.properties?.address).toEqual({ $ref: '#/$defs/Address' });
      expect(schema.properties?.contacts).toEqual({
        type: 'array',
        items: { $ref: '#/$defs/Contact' },
      });
      expect(schema.$defs?.Address).toBeDefined();
      expect(schema.$defs?.Contact).toBeDefined();
    });
  });

  describe('Discriminated unions', () => {
    it('should handle discriminated union pattern', () => {
      const schema = toJsonSchema(`
        interface Circle {
          kind: "circle";
          radius: number;
        }

        interface Square {
          kind: "square";
          size: number;
        }

        interface Rectangle {
          kind: "rectangle";
          width: number;
          height: number;
        }

        type Shape = Circle | Square | Rectangle;
      `, { rootType: 'Shape', includeSchema: false });

      expect(schema.anyOf).toBeDefined();
      expect(schema.anyOf).toHaveLength(3);
      expect(schema.$defs?.Circle).toBeDefined();
      expect(schema.$defs?.Square).toBeDefined();
      expect(schema.$defs?.Rectangle).toBeDefined();
    });
  });

  describe('Nested arrays and readonly', () => {
    it('should handle complex nested structures', () => {
      const schema = toJsonSchema(`
        interface Node {
          readonly id: string;
          value: number;
          children: Node[];
          tags: string[][];
        }
      `, { rootType: 'Node', includeSchema: false });

      expect(schema.properties?.id.readOnly).toBe(true);
      expect(schema.properties?.children).toEqual({
        type: 'array',
        items: { $ref: '#/$defs/Node' },
      });
      expect(schema.properties?.tags).toEqual({
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      });
    });
  });

  describe('Configuration schemas', () => {
    it('should handle typical config structure', () => {
      const schema = toJsonSchema(`
        interface DatabaseConfig {
          host: string;
          port: number;
          /** @default "postgres" */
          database?: string;
          ssl?: boolean;
        }

        interface ServerConfig {
          /**
           * @minimum 1024
           * @maximum 65535
           * @default 3000
           */
          port: number;
          host?: string;
        }

        interface AppConfig {
          server: ServerConfig;
          database: DatabaseConfig;
          /** @default "info" */
          logLevel?: "debug" | "info" | "warn" | "error";
        }
      `, { rootType: 'AppConfig', includeSchema: false });

      expect(schema.properties?.server).toEqual({ $ref: '#/$defs/ServerConfig' });
      expect(schema.properties?.database).toEqual({ $ref: '#/$defs/DatabaseConfig' });
      expect(schema.properties?.logLevel.enum).toEqual(['debug', 'info', 'warn', 'error']);
      expect(schema.$defs?.ServerConfig.properties?.port.minimum).toBe(1024);
    });
  });

  describe('Schema options', () => {
    it('should include $schema when requested', () => {
      const schema = toJsonSchema(`
        interface Simple {
          value: string;
        }
      `, { rootType: 'Simple', includeSchema: true });

      expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    });

    it('should respect strictObjects option', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string;
        }
      `, { rootType: 'User', includeSchema: false, strictObjects: true });

      expect(schema.additionalProperties).toBe(false);
    });

    it('should handle custom schema version', () => {
      const customVersion = 'https://json-schema.org/draft-07/schema';
      const schema = toJsonSchema(`
        interface Test {
          value: string;
        }
      `, { rootType: 'Test', includeSchema: true, schemaVersion: customVersion });

      expect(schema.$schema).toBe(customVersion);
    });
  });

  describe('Edge cases', () => {
    it('should handle export keyword', () => {
      const schema = toJsonSchema(`
        export interface User {
          name: string;
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema.type).toBe('object');
      expect(schema.properties?.name).toEqual({ type: 'string' });
    });

    it('should ignore single-line comments', () => {
      const schema = toJsonSchema(`
        // This is a comment
        interface User {
          name: string; // inline comment
          // another comment
          age: number;
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema.properties?.name).toBeDefined();
      expect(schema.properties?.age).toBeDefined();
    });

    it('should handle trailing commas', () => {
      const schema = toJsonSchema(`
        interface User {
          name: string,
          age: number,
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema.properties?.name).toBeDefined();
      expect(schema.properties?.age).toBeDefined();
    });
  });
});
