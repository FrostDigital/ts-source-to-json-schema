import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('@oneOf / @anyOf JSDoc tags', () => {
  describe('required groups on interfaces', () => {
    it('should emit oneOf over required for @oneOf required(...) | required(...)', () => {
      const schema = toJsonSchema(`
        /**
         * Either (message + to) or (message + conversationId), never both.
         * @oneOf required(message, to) | required(message, conversationId)
         */
        interface SendMessageRequest {
          message: string;
          to?: string[];
          conversationId?: string;
          referenceId?: string;
        }
      `, { rootType: 'SendMessageRequest', includeSchema: false });

      expect(schema.oneOf).toEqual([
        { required: ['message', 'to'] },
        { required: ['message', 'conversationId'] },
      ]);
      expect(schema.required).toEqual(['message']);
      expect(schema.description).toBe('Either (message + to) or (message + conversationId), never both.');
    });

    it('should emit anyOf over required for @anyOf', () => {
      const schema = toJsonSchema(`
        /** @anyOf required(email) | required(phoneNumber) | required(skypeId) */
        interface ContactRequest {
          email?: string;
          phoneNumber?: string;
          skypeId?: string;
        }
      `, { rootType: 'ContactRequest', includeSchema: false });

      expect(schema.anyOf).toEqual([
        { required: ['email'] },
        { required: ['phoneNumber'] },
        { required: ['skypeId'] },
      ]);
    });

    it('should accept bare property lists without the required() wrapper', () => {
      const schema = toJsonSchema(`
        /** @anyOf email | phoneNumber, skypeId */
        interface ContactRequest {
          email?: string;
          phoneNumber?: string;
          skypeId?: string;
        }
      `, { rootType: 'ContactRequest', includeSchema: false });

      expect(schema.anyOf).toEqual([
        { required: ['email'] },
        { required: ['phoneNumber', 'skypeId'] },
      ]);
    });

    it('should tolerate extra whitespace', () => {
      const schema = toJsonSchema(`
        /** @oneOf required( a ,b )|  required(c) */
        interface X { a?: string; b?: string; c?: string; }
      `, { rootType: 'X', includeSchema: false });

      expect(schema.oneOf).toEqual([{ required: ['a', 'b'] }, { required: ['c'] }]);
    });

    it('should work on object type aliases', () => {
      const schema = toJsonSchema(`
        /** @anyOf required(email) | required(phone) */
        type Contact = { email?: string; phone?: string };
      `, { rootType: 'Contact', includeSchema: false });

      expect(schema.anyOf).toEqual([{ required: ['email'] }, { required: ['phone'] }]);
    });

    it('should work on inline object properties', () => {
      const schema = toJsonSchema(`
        interface Wrapper {
          /** @anyOf required(email) | required(phone) */
          contact: { email?: string; phone?: string };
        }
      `, { rootType: 'Wrapper', includeSchema: false });

      expect(schema.properties?.contact.anyOf).toEqual([{ required: ['email'] }, { required: ['phone'] }]);
    });

    it('should combine with interface extends (allOf)', () => {
      const schema = toJsonSchema(`
        interface Base { message: string; }
        /** @oneOf required(to) | required(conversationId) */
        interface Req extends Base { to?: string[]; conversationId?: string; }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.allOf).toHaveLength(2);
      expect(schema.oneOf).toEqual([{ required: ['to'] }, { required: ['conversationId'] }]);
    });

    it('should combine with @additionalProperties false', () => {
      const schema = toJsonSchema(`
        /**
         * @additionalProperties false
         * @oneOf required(to) | required(conversationId)
         */
        interface Req { message: string; to?: string[]; conversationId?: string; }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.additionalProperties).toBe(false);
      expect(schema.oneOf).toEqual([{ required: ['to'] }, { required: ['conversationId'] }]);
    });

    it('should still let an index signature win over @additionalProperties at declaration level', () => {
      const schema = toJsonSchema(`
        /** @additionalProperties false */
        interface Req { [key: string]: string; }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.additionalProperties).toEqual({ type: 'string' });
    });

    it('should ignore the tags when includeJSDoc is false', () => {
      const schema = toJsonSchema(`
        /** @oneOf required(a) | required(b) */
        interface X { a?: string; b?: string; }
      `, { rootType: 'X', includeSchema: false, includeJSDoc: false });

      expect(schema.oneOf).toBeUndefined();
    });
  });

  describe('bare @oneOf on union type aliases', () => {
    it('should emit oneOf instead of anyOf for a union of object types', () => {
      const schema = toJsonSchema(`
        /** @oneOf */
        export type SendMessageRequest =
          | { message: string; to: string[]; referenceId?: string }
          | { message: string; conversationId: string };
      `, { rootType: 'SendMessageRequest', includeSchema: false });

      expect(schema.anyOf).toBeUndefined();
      expect(schema.oneOf).toEqual([
        {
          type: 'object',
          properties: { message: { type: 'string' }, to: { type: 'array', items: { type: 'string' } }, referenceId: { type: 'string' } },
          required: ['message', 'to'],
        },
        {
          type: 'object',
          properties: { message: { type: 'string' }, conversationId: { type: 'string' } },
          required: ['message', 'conversationId'],
        },
      ]);
    });

    it('should keep anyOf by default for unions', () => {
      const schema = toJsonSchema(`
        export type Req = { a: string } | { b: string };
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.anyOf).toHaveLength(2);
      expect(schema.oneOf).toBeUndefined();
    });

    it('should work for unions of referenced types', () => {
      const schema = toJsonSchema(`
        interface A { a: string }
        interface B { b: string }
        /** @oneOf */
        type AorB = A | B;
      `, { rootType: 'AorB', includeSchema: false });

      expect(schema.oneOf).toEqual([{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }]);
    });

    it('should be a no-op for bare @anyOf and for non-union types', () => {
      const schema = toJsonSchema(`
        /** @anyOf */
        type Req = { a: string } | { b: string };
        /** @oneOf */
        interface Plain { a: string }
      `, { rootType: 'Req', includeSchema: false });

      expect(schema.anyOf).toHaveLength(2);
      expect(schema.$defs?.Plain).toEqual({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] });
    });
  });
});
