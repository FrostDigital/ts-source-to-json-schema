/**
 * End-to-end validation of the two scenarios from flink-framework issue #89:
 *   1. @format on an array property must be enforced on each element
 *   2. @oneOf / @anyOf over required groups must be enforceable
 */
import { describe, it, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { toJsonSchema } from '../../src/index.js';

function compile(source: string, rootType: string) {
  const schema = toJsonSchema(source, { rootType, includeSchema: false });
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

const UUID = '3b241101-e2bb-4255-8caf-4136c566a962';

describe('issue #89 scenarios validated with ajv', () => {
  it('rejects non-uuid elements in a @format uuid string[]', () => {
    const validate = compile(`
      export interface SendMessageRequest {
        /** @format uuid */
        to?: string[];
        /** @format uuid */
        conversationId?: string;
      }
    `, 'SendMessageRequest');

    expect(validate({ to: [UUID] })).toBe(true);
    expect(validate({ to: ['not-a-uuid'] })).toBe(false);
    expect(validate.errors?.[0].instancePath).toBe('/to/0');
    expect(validate.errors?.[0].message).toBe('must match format "uuid"');
  });

  it('enforces @oneOf required groups on an interface', () => {
    const validate = compile(`
      /** @oneOf required(message, to) | required(message, conversationId) */
      export interface SendMessageRequest {
        message: string;
        to?: string[];
        conversationId?: string;
      }
    `, 'SendMessageRequest');

    expect(validate({ message: 'hi', to: [UUID] })).toBe(true);
    expect(validate({ message: 'hi', conversationId: UUID })).toBe(true);
    expect(validate({ message: 'hi' })).toBe(false);
    expect(validate({ message: 'hi', to: [UUID], conversationId: UUID })).toBe(false);
  });

  it('enforces @anyOf required groups on an interface', () => {
    const validate = compile(`
      /** @anyOf required(email) | required(phoneNumber) | required(skypeId) */
      export interface ContactRequest {
        email?: string;
        phoneNumber?: string;
        skypeId?: string;
      }
    `, 'ContactRequest');

    expect(validate({})).toBe(false);
    expect(validate({ email: 'a@b.c' })).toBe(true);
    expect(validate({ phoneNumber: '123', skypeId: 'x' })).toBe(true);
  });

  it('enforces a @oneOf discriminated union type alias', () => {
    const validate = compile(`
      /** @oneOf */
      export type SendMessageRequest =
        | { message: string; to: string[]; referenceId?: string }
        | { message: string; conversationId: string };
    `, 'SendMessageRequest');

    expect(validate({ message: 'hi', to: [UUID] })).toBe(true);
    expect(validate({ message: 'hi', conversationId: UUID })).toBe(true);
    expect(validate({ message: 'hi' })).toBe(false);
    // Matches both branches → fails oneOf ("never both")
    expect(validate({ message: 'hi', to: [UUID], conversationId: UUID })).toBe(false);
  });
});
