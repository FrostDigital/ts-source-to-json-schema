import { toJsonSchema } from './src/index.js';

try {
  const result = toJsonSchema(`
    interface Animal {
      name: string;
    }
    export interface Dog extends Animal {
      breed: string;
    }
  `, { rootType: 'Dog', includeSchema: false });
  console.log('Success:', JSON.stringify(result, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
