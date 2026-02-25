import { describe, it, expect } from '@jest/globals';
import { toJsonSchema } from '../../src/index.js';

describe('Recursive types with rootType', () => {
  it('should handle self-referential type with rootType', () => {
    const source = `
      interface TreeNode {
        id: string;
        name: string;
        children?: TreeNode[];
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'TreeNode' });

    // Root should be a $ref to the definition
    expect(schema.$ref).toBe('#/$defs/TreeNode');

    // TreeNode should be in $defs
    expect(schema.$defs).toBeDefined();
    expect(schema.$defs!.TreeNode).toBeDefined();

    // The definition should have the correct structure
    const treeDef = schema.$defs!.TreeNode;
    expect(treeDef.type).toBe('object');
    expect(treeDef.properties).toBeDefined();
    expect(treeDef.properties!.id).toEqual({ type: 'string' });
    expect(treeDef.properties!.name).toEqual({ type: 'string' });

    // Children should reference TreeNode
    expect(treeDef.properties!.children).toEqual({
      type: 'array',
      items: { $ref: '#/$defs/TreeNode' }
    });
  });

  it('should handle deeply nested recursive type', () => {
    const source = `
      interface Node {
        value: number;
        left?: Node;
        right?: Node;
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'Node' });

    expect(schema.$ref).toBe('#/$defs/Node');
    expect(schema.$defs!.Node).toBeDefined();

    const nodeDef = schema.$defs!.Node;
    expect(nodeDef.properties!.left).toEqual({ $ref: '#/$defs/Node' });
    expect(nodeDef.properties!.right).toEqual({ $ref: '#/$defs/Node' });
  });

  it('should handle recursive type with array', () => {
    const source = `
      interface Comment {
        id: string;
        text: string;
        replies: Comment[];
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'Comment' });

    expect(schema.$ref).toBe('#/$defs/Comment');

    const commentDef = schema.$defs!.Comment;
    expect(commentDef.properties!.replies).toEqual({
      type: 'array',
      items: { $ref: '#/$defs/Comment' }
    });
  });

  it('should NOT use $ref for non-recursive types', () => {
    const source = `
      interface User {
        id: string;
        name: string;
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'User' });

    // Non-recursive type should be emitted directly (no $ref at root)
    expect(schema.$ref).toBeUndefined();
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.id).toEqual({ type: 'string' });
  });

  it('should handle type alias to recursive type', () => {
    const source = `
      type LinkedListNode = {
        value: number;
        next?: LinkedListNode;
      };
    `;

    const schema = toJsonSchema(source, { rootType: 'LinkedListNode' });

    expect(schema.$ref).toBe('#/$defs/LinkedListNode');

    const def = schema.$defs!.LinkedListNode;
    expect(def.properties!.next).toEqual({ $ref: '#/$defs/LinkedListNode' });
  });

  it('should include $schema field with recursive types', () => {
    const source = `
      interface TreeNode {
        id: string;
        children?: TreeNode[];
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'TreeNode', includeSchema: true });

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$ref).toBe('#/$defs/TreeNode');
  });

  it('should handle recursive type with other types in source', () => {
    const source = `
      interface User {
        id: string;
        name: string;
      }

      interface Post {
        id: string;
        title: string;
        author: User;
        comments: Comment[];
      }

      interface Comment {
        id: string;
        text: string;
        replies: Comment[];
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'Comment' });

    // Comment is recursive, so it should be a $ref
    expect(schema.$ref).toBe('#/$defs/Comment');

    // Comment definition should be in $defs
    expect(schema.$defs!.Comment).toBeDefined();

    // Note: All types are currently included in $defs (not just referenced ones)
    expect(schema.$defs!.User).toBeDefined();
    expect(schema.$defs!.Post).toBeDefined();
  });

  it('should handle mutually recursive types with rootType', () => {
    const source = `
      interface A {
        id: string;
        b?: B;
      }

      interface B {
        id: string;
        a?: A;
      }
    `;

    const schema = toJsonSchema(source, { rootType: 'A' });

    // A → B → A is transitive recursion, so A should be a $ref
    expect(schema.$ref).toBe('#/$defs/A');

    // Both A and B should be in $defs
    expect(schema.$defs!.A).toBeDefined();
    expect(schema.$defs!.B).toBeDefined();

    // Verify the mutual references
    expect(schema.$defs!.A.properties!.b).toEqual({ $ref: '#/$defs/B' });
    expect(schema.$defs!.B.properties!.a).toEqual({ $ref: '#/$defs/A' });
  });
});
