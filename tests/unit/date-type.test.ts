import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Date Type', () => {
  it('should convert Date to string with format date-time', () => {
    const schema = toJsonSchema(`
      interface Event {
        title: string;
        timestamp: Date;
      }
    `, { rootType: 'Event', includeSchema: false });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['title', 'timestamp'],
    });
  });

  it('should handle optional Date properties', () => {
    const schema = toJsonSchema(`
      interface Log {
        message: string;
        created?: Date;
      }
    `, { rootType: 'Log', includeSchema: false });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        message: { type: 'string' },
        created: { type: 'string', format: 'date-time' },
      },
      required: ['message'],
    });
  });

  it('should handle Date with JSDoc description', () => {
    const schema = toJsonSchema(`
      interface Pet {
        /**
         * Date when pet was created
         */
        created: Date;
      }
    `, { rootType: 'Pet', includeSchema: false });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        created: {
          type: 'string',
          format: 'date-time',
          description: 'Date when pet was created',
        },
      },
      required: ['created'],
    });
  });

  it('should handle Date in type alias', () => {
    const schema = toJsonSchema(`
      type Timestamp = Date;
    `, { rootType: 'Timestamp', includeSchema: false });

    expect(schema).toEqual({
      type: 'string',
      format: 'date-time',
    });
  });

  it('should handle Date in union types', () => {
    const schema = toJsonSchema(`
      interface Record {
        value: string | Date;
      }
    `, { rootType: 'Record', includeSchema: false });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        value: {
          anyOf: [
            { type: 'string' },
            { type: 'string', format: 'date-time' },
          ],
        },
      },
      required: ['value'],
    });
  });

  it('should handle Date in array types', () => {
    const schema = toJsonSchema(`
      interface Timeline {
        dates: Date[];
      }
    `, { rootType: 'Timeline', includeSchema: false });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        dates: {
          type: 'array',
          items: { type: 'string', format: 'date-time' },
        },
      },
      required: ['dates'],
    });
  });

  it('should handle Date with readonly modifier', () => {
    const schema = toJsonSchema(`
      interface Immutable {
        readonly created: Date;
      }
    `, { rootType: 'Immutable', includeSchema: false });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        created: {
          type: 'string',
          format: 'date-time',
          readOnly: true,
        },
      },
      required: ['created'],
    });
  });
});
