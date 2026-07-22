// Standalone Node runner that mirrors the in-browser self-test harness so
// we can validate the algorithm ports against the Rust behaviour without a
// browser. This is NOT shipped — it's a dev tool. Run from repo root:
//   node test-selftest.mjs
// Exit 0 = all pass, non-zero = at least one fail.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no <script> tag found'); process.exit(2); }

// Stub browser globals so the bootstrap short-circuits.
const ctx = vm.createContext({
  console,
  setTimeout, clearTimeout,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => {},
  navigator: undefined,
  location: { search: '' },
  window: { addEventListener: () => {}, devicePixelRatio: 1 },
  document: {
    getElementById: () => null,
    addEventListener: () => {},
    createElement: () => ({ className: '', innerHTML: '', appendChild: () => {}, addEventListener: () => {} }),
    body: { appendChild: () => {} },
    clientWidth: 1024, clientHeight: 768,
  },
  Math, Float32Array, Uint8Array, Uint32Array, Int32Array, Array, Object, JSON, Error,
  Promise: globalThis.Promise,
});
// Suppress WebGPU creation attempts and append a global hook so the test
// harness can grab references from outside the IIFE-like scope.
const source = m[1]
  .replace(/if \(!forceCpu && navigator\.gpu\)/, 'if (false)')
  .replace(/async function createComputeBackend[\s\S]*?\n}\n/, '')
  + `\n;globalThis.__test_exports__ = { TestRunner, registerTests, runUniform, runSphere };\n`;
vm.runInContext(source, ctx);

// Run tests via the context.
const TestRunner = ctx.__test_exports__.TestRunner;
const registerTests = ctx.__test_exports__.registerTests;
if (!TestRunner || !registerTests) {
  console.error('failed to extract TestRunner/registerTests from script');
  process.exit(2);
}
const tr = new TestRunner();
registerTests(tr);
const result = await tr.runAll();
console.log(`\n[selftest] ${result.passed}/${result.total} passed (${result.failed} failed)`);
for (const r of result.log) {
  const tag = r.status === 'PASS' ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`${tag} ${r.name}${r.error ? '\n   ' + r.error : ''}`);
}
process.exit(result.failed === 0 ? 0 : 1);