import { toJsonSchema } from './src/index.js';

try {
  const result = toJsonSchema(`
    interface Pet {
      name: string;
      _id: string;
      created: string;
    }
    export interface PostPetReq extends Omit<Pet, "_id" | "created"> {}
  `, { rootType: 'PostPetReq', includeSchema: false });
  console.log('Success:', JSON.stringify(result, null, 2));
} catch (e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack);
}
