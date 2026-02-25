import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('additionalProperties Configuration', () => {
  describe('@additionalProperties JSDoc tag', () => {
    it('should apply @additionalProperties false at interface level', () => {
      const schema = toJsonSchema(`
        /**
         * User configuration
         * @additionalProperties false
         */
        interface Config {
          host: string;
          port: number;
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.additionalProperties).toBe(false);
      expect(schema.type).toBe('object');
    });

    it('should apply @additionalProperties true at interface level', () => {
      const schema = toJsonSchema(`
        /**
         * Flexible config
         * @additionalProperties true
         */
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.additionalProperties).toBe(true);
    });

    it('should apply @additionalProperties at type alias level', () => {
      const schema = toJsonSchema(`
        /**
         * Config type
         * @additionalProperties false
         */
        type Config = {
          host: string;
          port: number;
        };
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.additionalProperties).toBe(false);
      expect(schema.type).toBe('object');
    });

    it('should apply @additionalProperties at property level', () => {
      const schema = toJsonSchema(`
        interface Settings {
          /**
           * Database config
           * @additionalProperties false
           */
          database: {
            host: string;
            port: number;
          };
        }
      `, { rootType: 'Settings', includeSchema: false });

      expect(schema.properties?.database.additionalProperties).toBe(false);
      expect(schema.properties?.database.type).toBe('object');
    });

    it('should ignore @additionalProperties when includeJSDoc is false', () => {
      const schema = toJsonSchema(`
        /**
         * Config
         * @additionalProperties false
         */
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, includeJSDoc: false });

      expect(schema.additionalProperties).toBeUndefined();
    });

    it('should handle case-insensitive values', () => {
      const schema1 = toJsonSchema(`
        /** @additionalProperties FALSE */
        interface Config1 { host: string; }
      `, { rootType: 'Config1', includeSchema: false });

      const schema2 = toJsonSchema(`
        /** @additionalProperties True */
        interface Config2 { host: string; }
      `, { rootType: 'Config2', includeSchema: false });

      expect(schema1.additionalProperties).toBe(false);
      expect(schema2.additionalProperties).toBe(true);
    });
  });

  describe('additionalProperties configuration option', () => {
    it('should set additionalProperties false globally when option is false', () => {
      const schema = toJsonSchema(`
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, additionalProperties: false });

      expect(schema.additionalProperties).toBe(false);
    });

    it('should set additionalProperties true globally when option is true', () => {
      const schema = toJsonSchema(`
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, additionalProperties: true });

      expect(schema.additionalProperties).toBe(true);
    });

    it('should not set additionalProperties when option is undefined', () => {
      const schema = toJsonSchema(`
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.additionalProperties).toBeUndefined();
    });
  });

  describe('Precedence rules', () => {
    it('should prioritize index signature over @additionalProperties tag', () => {
      const schema = toJsonSchema(`
        /**
         * Config
         * @additionalProperties false
         */
        interface Config {
          host: string;
          [key: string]: any;
        }
      `, { rootType: 'Config', includeSchema: false });

      // Index signature should win, so additionalProperties should be the type from the index signature
      expect(schema.additionalProperties).toEqual({});
    });

    it('should prioritize @additionalProperties tag over strictObjects option', () => {
      const schema = toJsonSchema(`
        /**
         * Config
         * @additionalProperties true
         */
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, strictObjects: true });

      expect(schema.additionalProperties).toBe(true);
    });

    it('should prioritize strictObjects over additionalProperties option', () => {
      const schema = toJsonSchema(`
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, strictObjects: true, additionalProperties: true });

      expect(schema.additionalProperties).toBe(false);
    });

    it('should use additionalProperties option when no other constraints exist', () => {
      const schema = toJsonSchema(`
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, additionalProperties: false });

      expect(schema.additionalProperties).toBe(false);
    });

    it('should prioritize @additionalProperties tag over additionalProperties option', () => {
      const schema = toJsonSchema(`
        /**
         * Config
         * @additionalProperties true
         */
        interface Config {
          host: string;
        }
      `, { rootType: 'Config', includeSchema: false, additionalProperties: false });

      expect(schema.additionalProperties).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should only apply @additionalProperties to object types', () => {
      const schema = toJsonSchema(`
        /**
         * User ID
         * @additionalProperties false
         */
        type UserId = string;
      `, { rootType: 'UserId', includeSchema: false });

      // Should not apply to non-object types
      expect(schema.additionalProperties).toBeUndefined();
      expect(schema.type).toBe('string');
    });

    it('should work with interface extends', () => {
      const schema = toJsonSchema(`
        interface Base {
          id: string;
        }
        /**
         * User
         * @additionalProperties false
         */
        interface User extends Base {
          name: string;
        }
      `, { rootType: 'User', includeSchema: false });

      expect(schema.description).toContain('User');
      expect(schema.allOf).toBeDefined();
      // The description should be on the wrapper, not the object schema
    });

    it('should work with nested objects at property level', () => {
      const schema = toJsonSchema(`
        interface Config {
          /**
           * Database settings
           * @additionalProperties false
           */
          database: {
            host: string;
            port: number;
          };
          /**
           * Cache settings
           * @additionalProperties true
           */
          cache: {
            enabled: boolean;
          };
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.properties?.database.additionalProperties).toBe(false);
      expect(schema.properties?.cache.additionalProperties).toBe(true);
    });

    it('should combine with other JSDoc tags', () => {
      const schema = toJsonSchema(`
        /**
         * User configuration
         * @title User Config
         * @additionalProperties false
         */
        interface Config {
          /**
           * Username
           * @minLength 3
           */
          username: string;
        }
      `, { rootType: 'Config', includeSchema: false });

      expect(schema.description).toBe('User configuration');
      expect(schema.additionalProperties).toBe(false);
      expect(schema.properties?.username.minLength).toBe(3);
    });
  });
});
