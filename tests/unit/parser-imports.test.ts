import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Parser Import Statement Handling', () => {
  it('should skip import type with named imports', () => {
    const source = `
      import type { AgentState } from "./types";

      export interface BrandChatSession {
        state?: AgentState;
      }
    `;

    const schema = toJsonSchema(source, 'BrandChatSession');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.BrandChatSession).toMatchObject({
      type: 'object',
      properties: {
        state: { $ref: '#/$defs/AgentState' }
      }
    });
  });

  it('should skip import type with default import', () => {
    const source = `
      import type User from "./user";

      export interface ApiResponse {
        user: User;
      }
    `;

    const schema = toJsonSchema(source, 'ApiResponse');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.ApiResponse).toMatchObject({
      type: 'object',
      properties: {
        user: { $ref: '#/$defs/User' }
      },
      required: ['user']
    });
  });

  it('should skip import type with namespace import', () => {
    const source = `
      import type * as Types from "./types";

      export interface Data {
        value: string;
      }
    `;

    const schema = toJsonSchema(source, 'Data');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.Data).toMatchObject({
      type: 'object',
      properties: {
        value: { type: 'string' }
      },
      required: ['value']
    });
  });

  it('should skip regular named imports', () => {
    const source = `
      import { BaseEntity } from "./base";

      export interface User {
        id: string;
      }
    `;

    const schema = toJsonSchema(source, 'User');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.User).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    });
  });

  it('should skip regular default imports', () => {
    const source = `
      import BaseEntity from "./base";

      export interface User {
        id: string;
      }
    `;

    const schema = toJsonSchema(source, 'User');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.User).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    });
  });

  it('should skip regular namespace imports', () => {
    const source = `
      import * as Types from "./types";

      export interface Data {
        value: string;
      }
    `;

    const schema = toJsonSchema(source, 'Data');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.Data).toMatchObject({
      type: 'object',
      properties: {
        value: { type: 'string' }
      },
      required: ['value']
    });
  });

  it('should handle multiple imports in sequence', () => {
    const source = `
      import { BaseEntity } from "./base";
      import type { User } from "./user";
      import * as Types from "./types";

      export interface ApiResponse {
        id: string;
        name: string;
      }
    `;

    const schema = toJsonSchema(source, 'ApiResponse');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.ApiResponse).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id', 'name']
    });
  });

  it('should handle imports with JSDoc comments', () => {
    const source = `
      /** Base entity import */
      import { BaseEntity } from "./base";

      /** User response schema */
      export interface UserResponse {
        id: string;
      }
    `;

    const schema = toJsonSchema(source, 'UserResponse');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.UserResponse).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id'],
      description: 'User response schema'
    });
  });

  it('should handle imports at end of file', () => {
    const source = `
      export interface User {
        id: string;
      }

      import { BaseEntity } from "./base";
    `;

    const schema = toJsonSchema(source, 'User');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.User).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    });
  });

  it('should handle imports between declarations', () => {
    const source = `
      export interface User {
        id: string;
      }

      import { BaseEntity } from "./base";

      export interface Product {
        name: string;
      }
    `;

    const schema = toJsonSchema(source, 'Product');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.Product).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    });
  });

  it('should handle import with multiple named imports', () => {
    const source = `
      import type { User, Product, Order } from "./types";

      export interface ApiData {
        id: string;
      }
    `;

    const schema = toJsonSchema(source, 'ApiData');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.ApiData).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' }
      },
      required: ['id']
    });
  });

  it('should handle import with semicolon', () => {
    const source = `
      import type { User } from "./user";

      export interface Data {
        value: string;
      }
    `;

    const schema = toJsonSchema(source, 'Data');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.Data).toMatchObject({
      type: 'object',
      properties: {
        value: { type: 'string' }
      },
      required: ['value']
    });
  });

  it('should handle import without semicolon', () => {
    const source = `
      import type { User } from "./user"

      export interface Data {
        value: string;
      }
    `;

    const schema = toJsonSchema(source, 'Data');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.Data).toMatchObject({
      type: 'object',
      properties: {
        value: { type: 'string' }
      },
      required: ['value']
    });
  });

  it('should handle the exact Flink use case from bug report', () => {
    const source = `
      import type { AgentState } from "../services/agents/types";

      export interface BrandChatSession {
        state?: AgentState;
        brandId: string;
        sessionId: string;
      }
    `;

    const schema = toJsonSchema(source, 'BrandChatSession');

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$defs?.BrandChatSession).toMatchObject({
      type: 'object',
      properties: {
        state: { $ref: '#/$defs/AgentState' },
        brandId: { type: 'string' },
        sessionId: { type: 'string' }
      },
      required: ['brandId', 'sessionId']
    });
  });
});
