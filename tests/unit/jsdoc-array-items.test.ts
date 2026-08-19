import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('JSDoc constraints on array properties', () => {
  describe('value constraints are routed to items', () => {
    it('should apply @format to items of T[]', () => {
      const schema = toJsonSchema(`
        interface SendMessageRequest {
          /** @format uuid */
          to?: string[];
          /** @format uuid */
          conversationId?: string;
        }
      `, { rootType: 'SendMessageRequest', includeSchema: false });

      expect(schema.properties?.to).toEqual({
        type: 'array',
        items: { type: 'string', format: 'uuid' },
      });
      expect(schema.properties?.conversationId).toEqual({ type: 'string', format: 'uuid' });
    });

    it('should apply @pattern, @minLength and @maxLength to items', () => {
      const schema = toJsonSchema(`
        interface Tags {
          /**
           * @pattern ^[a-z]+$
           * @minLength 2
           * @maxLength 10
           */
          tags: string[];
        }
      `, { rootType: 'Tags', includeSchema: false });

      expect(schema.properties?.tags).toEqual({
        type: 'array',
        items: { type: 'string', pattern: '^[a-z]+$', minLength: 2, maxLength: 10 },
      });
    });

    it('should apply @minimum and @maximum to items of number[]', () => {
      const schema = toJsonSchema(`
        interface Scores {
          /**
           * @minimum 0
           * @maximum 100
           */
          scores: number[];
        }
      `, { rootType: 'Scores', includeSchema: false });

      expect(schema.properties?.scores).toEqual({
        type: 'array',
        items: { type: 'number', minimum: 0, maximum: 100 },
      });
    });

    it('should work with Array<T> syntax', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @format email */
          recipients: Array<string>;
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.recipients.items).toEqual({ type: 'string', format: 'email' });
      expect(schema.properties?.recipients.format).toBeUndefined();
    });

    it('should work with readonly arrays', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @format uuid */
          readonly ids: readonly string[];
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.ids.items).toEqual({ type: 'string', format: 'uuid' });
      expect(schema.properties?.ids.readOnly).toBe(true);
    });

    it('should work with nullable arrays', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @format uuid */
          ids: string[] | null;
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.ids).toEqual({
        type: ['array', 'null'],
        items: { type: 'string', format: 'uuid' },
      });
    });

    it('should route to the innermost items for nested arrays', () => {
      const schema = toJsonSchema(`
        interface Matrix {
          /** @minimum 0 */
          rows: number[][];
        }
      `, { rootType: 'Matrix', includeSchema: false });

      expect(schema.properties?.rows).toEqual({
        type: 'array',
        items: { type: 'array', items: { type: 'number', minimum: 0 } },
      });
    });

    it('should apply @additionalProperties to items of an inline object array', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @additionalProperties false */
          entries: { key: string }[];
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.entries.items?.additionalProperties).toBe(false);
      expect(schema.properties?.entries.additionalProperties).toBeUndefined();
    });

    it('should apply to array type aliases', () => {
      const schema = toJsonSchema(`
        /** @format uuid */
        type Ids = string[];
      `, { rootType: 'Ids', includeSchema: false });

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string', format: 'uuid' },
      });
    });
  });

  describe('array-level tags stay on the array', () => {
    it('should keep @minItems, @maxItems and @uniqueItems on the array', () => {
      const schema = toJsonSchema(`
        interface Req {
          /**
           * @format uuid
           * @minItems 1
           * @maxItems 10
           * @uniqueItems
           */
          to: string[];
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.to).toEqual({
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 10,
        uniqueItems: true,
      });
    });

    it('should support @uniqueItems true/false explicitly', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @uniqueItems true */
          a: string[];
          /** @uniqueItems false */
          b: string[];
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.a.uniqueItems).toBe(true);
      expect(schema.properties?.b.uniqueItems).toBe(false);
    });

    it('should keep metadata tags (description, @title, @default, @example, @deprecated) on the array', () => {
      const schema = toJsonSchema(`
        interface Req {
          /**
           * Recipient ids
           * @title Recipients
           * @default []
           * @example ["a"]
           * @deprecated
           * @format uuid
           */
          to: string[];
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.to).toEqual({
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Recipient ids',
        title: 'Recipients',
        default: [],
        examples: [['a']],
        deprecated: true,
      });
    });

    it('should not route constraints into tuple elements', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @minItems 1 */
          pair: [string, number];
        }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.properties?.pair.prefixItems).toEqual([{ type: 'string' }, { type: 'number' }]);
      expect(schema.properties?.pair.minItems).toBe(1);
    });
  });

  describe('includeJSDoc: false', () => {
    it('should ignore item constraints when JSDoc is disabled', () => {
      const schema = toJsonSchema(`
        interface Req {
          /** @format uuid */
          to: string[];
        }
      `, { rootType: 'Req', includeSchema: false, includeJSDoc: false });

      expect(schema.properties?.to).toEqual({ type: 'array', items: { type: 'string' } });
    });
  });
});
