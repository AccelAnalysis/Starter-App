/* Standalone execution of the same pure-domain tests, using Node's test runner.
 * Requires TypeScript only. It does NOT run Firebase or browser integration tests.
 * This adapter implements exactly the assertions used by domain.test.ts; an
 * unsupported assertion throws rather than silently passing.
 */
import ts from 'typescript';
import Module, { createRequire } from 'node:module';
const load = createRequire(import.meta.url);
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
function expect(actual, negate = false) {
  const check = (fn) => negate ? assert.throws(fn) : fn();
  return {
    get not() { return expect(actual, !negate); },
    toBe(expected) { check(() => assert.strictEqual(actual, expected)); },
    toEqual(expected) { check(() => assert.deepStrictEqual(actual, expected)); },
    toHaveLength(expected) { check(() => assert.strictEqual(actual.length, expected)); },
    toContain(expected) { check(() => assert.ok(actual.includes(expected))); },
    toThrow(expected) { if (negate) return assert.doesNotThrow(actual); let caught; try { actual(); } catch (e) { caught = e; } assert.ok(caught, 'Expected the operation to throw.'); if (typeof expected === 'string') assert.ok(caught.message.includes(expected), `Expected error containing ${expected}, received ${caught.message}`); else if (expected instanceof RegExp) assert.match(caught.message, expected); },
  };
}
load.extensions['.ts'] = (module, filename) => { const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }); module._compile(result.outputText, filename); };
const original = Module._load;
Module._load = function(request, ...args) { if (request === 'vitest') return { describe, it, expect }; return original.call(this, request, ...args); };
load('../tests/domain.test.ts');

load('../tests/regressions.test.ts');

load('../tests/metrics.test.ts');

load('../tests/privacy.test.ts');
