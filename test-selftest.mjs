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

// --- GLSL pre-flight: catch reserved-keyword-as-identifier mistakes.
// GLSL ES 3.00 reserves many words that JavaScript happily accepts as
// variable names. The browser compiler only fails at runtime, which is
// too late. We scan the fragment + vertex shader source here.
const RESERVED = new Set(`
asm class union enum typedef template this packed resource goto switch default
inline noinline volatile public static extern external interface
long short double half fixed unsigned superp
hvec2 hvec3 hvec4 fvec2 fvec3 fvec4 sampler2DRect sampler3DRect
sampler2DRectShadow sizeof cast namespace using
row_major common centroid flat smooth noperspective
patch sample subroutine
input output lowp mediump highp precision invariant discard return
mat2 mat3 mat4 dmat2 dmat3 dmat4
mat2x2 mat2x3 mat2x4 dmat2x2 dmat2x3 dmat2x4
mat3x2 mat3x3 mat3x4 dmat3x2 dmat3x3 dmat3x4
mat4x2 mat4x3 mat4x4 dmat4x2 dmat4x3 dmat4x4
vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4 dvec2 dvec3 dvec4
uvec2 uvec3 uvec4
float int void bool uint
sampler1D sampler2D sampler3D samplerCube
sampler1DShadow sampler2DShadow samplerCubeShadow
sampler1DArray sampler2DArray sampler1DArrayShadow sampler2DArrayShadow
isampler1D isampler2D isampler3D isamplerCube
isampler1DArray isampler2DArray
usampler1D usampler2D usampler3D usamplerCube
usampler1DArray usampler2DArray
sampler2DMS sampler2DMSArray isampler2DMS isampler2DMSArray
usampler2DMS usampler2DMSArray
samplerCubeArray samplerCubeArrayShadow
isamplerCubeArray usamplerCubeArray
samplerBuffer isamplerBuffer usamplerBuffer
image1D image2D image3D imageCube iimage1D iimage2D iimage3D iimageCube
uimage1D uimage2D uimage3D uimageCube
image1DArray image2DArray iimage1DArray iimage2DArray
uimage1DArray uimage2DArray
image1DShadow image2DShadow image1DArrayShadow image2DArrayShadow
imageBuffer iimageBuffer uimageBuffer
atomic_uint in out inout
`.trim().split(/\s+/));

function findReservedWordCollisions(shaderSrc, label) {
  // Strip line comments and block comments. Keep newlines so we can scan
  // line-by-line.
  const src = shaderSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // The class of bug we want to catch is using a reserved word as a variable
  // name on the LHS of a declaration: `float sample = texture(...).r;` —
  // here `sample` is reserved and the compiler rejects it. Valid GLSL
  // declarations use a type followed by a NON-reserved identifier.
  //
  // We look for declaration patterns `<type> <varname> (= ... | ; | ,)` and
  // flag the assignment when <varname> is in RESERVED. To keep this from
  // catching function signatures and qualifiers, we anchor on `=` (only
  // decls with initializers can collide this way in practice).
  const collisions = [];
  // Try to match a chain of identifiers (some may be qualifiers, e.g.
  // `precision highp float`), then a reserved word, then `=` or `(` or
  // `,` or `;`. For our purposes we focus on the LHS of an initialiser.
  const declRe = /([A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)*?)\s*=\s*[^\n]/g;
  let m;
  while ((m = declRe.exec(src))) {
    // token list before `=` could be "float x", "precision highp float x",
    // "vec3 sample", etc. The last identifier is the variable name.
    // If the second-to-last is also reserved, this might be a chained
    // declaration like `int a, b = 1;` — skip the comma case.
    const tokens = m[1].trim().split(/\s+/);
    const varname = tokens[tokens.length - 1];
    // Need at least 2 tokens: a type + a name. If there's only 1 token, the
    // LHS is just a reserved word — that's the bare-assignment variant of
    // the same bug (`sample = texture(...)`).
    if (tokens.length === 1) {
      if (!RESERVED.has(varname)) continue;
      const lineStart = src.lastIndexOf('\n', m.index - 1) + 1;
      collisions.push({ word: varname, ctx: src.slice(lineStart,
        Math.min(src.length, lineStart + 80)).replace(/\s+/g, ' ').trim() });
      continue;
    }
    // 2+ tokens: middle tokens should be qualifiers (allowed reserved words
    // when chained) or types (which are part of a valid declaration). The
    // LAST token (varname) shouldn't be reserved.
    if (!RESERVED.has(varname)) continue;
    // Allow if the prior token is a known interpolation qualifier that
    // legitimately appears as the last word (e.g. `flat in`, `centroid in`,
    // `noperspective out`). These chains look weird but aren't bugs.
    const prev = tokens[tokens.length - 2];
    const QUALIFIER_PAIR_LAST = new Set([
      'in', 'out', 'inout', 'flat', 'smooth', 'noperspective', 'centroid',
      'patch', 'sample', 'subroutine'
    ]);
    if (QUALIFIER_PAIR_LAST.has(prev)) continue;
    const lineStart = src.lastIndexOf('\n', m.index - 1) + 1;
    collisions.push({ word: varname, ctx: src.slice(lineStart,
      Math.min(src.length, lineStart + 80)).replace(/\s+/g, ' ').trim() });
  }
  if (collisions.length) {
    console.error(`\n  ✗ ${label}: reserved keyword used as identifier:`);
    for (const c of collisions) {
      console.error(`    "${c.word}" — …${c.ctx}…`);
    }
  }
  return collisions;
}

const fragSrc = m[1].match(/const FRAG_SRC = `([\s\S]*?)`;/)?.[1];
const vertSrc = m[1].match(/const VERT_SRC = `([\s\S]*?)`;/)?.[1];
let shaderOk = true;
if (fragSrc) {
  const c = findReservedWordCollisions(fragSrc, 'FRAG_SRC');
  if (c.length) shaderOk = false;
}
if (vertSrc) {
  const c = findReservedWordCollisions(vertSrc, 'VERT_SRC');
  if (c.length) shaderOk = false;
}
if (!shaderOk) {
  console.error('\n[preflight] GLSL reserved-word collisions detected. Fix and re-run.');
  process.exit(2);
}
console.log('[preflight] GLSL reserved-word scan: OK');

// r32: purple-tile regression guard. The volumetric fragment shader
// gates each voxel on `d < THRESHOLD → continue;` to suppress FP-noise
// density leaks from bulk-flow regions. If someone drops the threshold
// back below 0.10, glancing-angle camera views will accumulate purple
// tiles again. Extract the constant from FRAG_SRC and fail if it's
// lower than 0.10. (Looks for `d < <num>` right after a comment about
// baseline/threshold so we don't false-positive on unrelated < compares.)
const thresholdMatch = fragSrc?.match(/if\s*\(\s*d\s*<\s*([0-9]+\.?[0-9]*)\s*\)/);
let purpleTileGuardOk = true;
if (!thresholdMatch) {
  console.error('\n  ✗ FRAG_SRC: could not find density threshold `d < N` guard.');
  purpleTileGuardOk = false;
} else {
  const thresh = parseFloat(thresholdMatch[1]);
  if (thresh < 0.10) {
    console.error(`\n  ✗ FRAG_SRC: density threshold ${thresh} too low (< 0.10). ` +
      `Purple tiles will return at glancing camera angles. Bump to ≥ 0.15.`);
    purpleTileGuardOk = false;
  } else {
    console.log(`[preflight] volumetric threshold = ${thresh} (purple-tile guard: OK)`);
  }
}
if (!purpleTileGuardOk) process.exit(2);

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