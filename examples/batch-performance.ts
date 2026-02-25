/**
 * Benchmark demonstrating performance improvement of toJsonSchemas() vs multiple toJsonSchema() calls
 *
 * Run with: npx tsx examples/batch-performance.ts
 */

import { toJsonSchema, toJsonSchemas } from '../src/index.js';

// Generate a source file with many types
function generateSource(numTypes: number): string {
  const types: string[] = [];

  // Create a base type
  types.push(`
    export interface BaseEntity {
      id: string;
      createdAt: Date;
      updatedAt: Date;
    }
  `);

  // Create many types that reference BaseEntity
  for (let i = 1; i <= numTypes; i++) {
    types.push(`
      export interface Type${i} extends BaseEntity {
        name${i}: string;
        value${i}: number;
        tags${i}: string[];
      }
    `);
  }

  return types.join('\n');
}

const typeCount = 30;
const source = generateSource(typeCount);
const typeNames = ['BaseEntity', ...Array.from({ length: typeCount }, (_, i) => `Type${i + 1}`)];

console.log(`\n🏁 Batch Schema Generation Performance Benchmark`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Source size: ${source.length} characters`);
console.log(`Number of types: ${typeNames.length}`);
console.log();

// Benchmark 1: Multiple toJsonSchema() calls
console.log(`📊 Method 1: Individual toJsonSchema() calls (${typeNames.length}x)`);
const start1 = performance.now();
const schemas1: Record<string, any> = {};
for (const typeName of typeNames) {
  schemas1[typeName] = toJsonSchema(source, { rootType: typeName });
}
const time1 = performance.now() - start1;
console.log(`   Time: ${time1.toFixed(2)}ms`);
console.log(`   Schemas generated: ${Object.keys(schemas1).length}`);
console.log();

// Benchmark 2: Single toJsonSchemas() call
console.log(`⚡ Method 2: Batch toJsonSchemas() call (1x)`);
const start2 = performance.now();
const schemas2 = toJsonSchemas(source);
const time2 = performance.now() - start2;
console.log(`   Time: ${time2.toFixed(2)}ms`);
console.log(`   Schemas generated: ${Object.keys(schemas2).length}`);
console.log();

// Calculate improvement
const improvement = ((time1 - time2) / time1) * 100;
const speedup = time1 / time2;

console.log(`📈 Results`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`   Improvement: ${improvement.toFixed(1)}% faster`);
console.log(`   Speedup: ${speedup.toFixed(2)}x`);
console.log();

// Verify results are equivalent (spot check)
const sampleType = 'Type5';
const def1 = schemas1[sampleType].$defs?.[sampleType] || schemas1[sampleType];
const def2 = schemas2[sampleType];

console.log(`✅ Verification (${sampleType})`);
console.log(`   Both methods produce valid schemas: ${!!def1 && !!def2}`);
console.log(`   Properties match: ${Object.keys(def1.properties || {}).length === Object.keys(def2.properties || {}).length}`);
console.log();

console.log(`💡 Recommendation: Use toJsonSchemas() when you need multiple schemas from the same source`);
console.log();
