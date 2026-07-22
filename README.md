# windsurf — 3D wind tunnel in your browser

Real-time 3D CFD wind-tunnel simulator. Single HTML file, no build step,
runs entirely in the browser via WebGPU compute (with a WebGL2 + CPU
fallback). Hosted on GitHub Pages.

The Rust implementation that this was ported from is preserved at
[**JorgeQuijano/windsurf-rust-archive**](https://github.com/JorgeQuijano/windsurf-rust-archive)
(the 4-crate `wgpu + egui` workspace, ~2300 LOC).

## What it does

- **Lattice Boltzmann** D3Q19 solver with bounce-back boundary handling
- **Obstacles**: sphere, box, cylinder, torus (full SDFs, ray-marched)
- **Live drag computation** (pressure integration over obstacle surface)
- **Streamline tracing** (RK2 particle integration through the velocity field)
- **3D volumetric ray-march** of the velocity/density field, viridis colour map
- **22 self-tests** that validate algorithm correctness (`?selftest=1`)

## Try it

👉 **<https://jorgequijano.github.io/windsurf/>**

Open the URL in Chrome / Edge for the fastest path (WebGPU). Safari and
Firefox fall back to the CPU solver + WebGL2 renderer.

Append `?selftest=1` to run the algorithm validation suite in the
console. Append `?cpu=1` to force the CPU fallback for comparison.

## Controls

| input | action |
|---|---|
| mouse drag | orbit camera |
| mouse wheel | dolly in/out |
| R | reset camera |
| `▶ Play` | run the solver continuously |
| `Step` | advance one LBM step |
| `Reset` | reset the field |
| sliders | `u_inf` (inlet velocity), `ν` (viscosity), steps/frame |

## Performance

| backend | 32³ grid | notes |
|---|---|---|
| WebGPU compute | 30–60 fps | Chrome / Edge on a recent GPU |
| CPU JS | 2–5 fps | Safari, Firefox, mobile — still usable |
| Rust (original) | 5–15 fps | baseline reference |

## Repository layout

```
.
├── index.html              the entire app (JS + WGSL + GLSL inline)
├── test-selftest.mjs       Node-based self-test runner for CI
├── .github/workflows/ci.yml GitHub Actions: headless self-test
└── README.md
```

The Rust port-of-port is intentionally not checked in — the entire app
is `index.html`. Edit → push → refresh → see change. The iteration
loop is sub-second on any commit.

## Validation

22 in-browser assertions (mirrors the Rust unit tests 1:1):

- D3Q19 weights and lattice indexing invariants
- Equilibrium distribution produces the expected steady state at t=0
- All four obstacle SDFs are negative inside, zero at the surface
- LBM relaxation parameter τ = ν/cs² + 0.5 is in the stable range
- Empty grid stays close to uniform over many steps
- Sphere obstacle produces measurable flow stagnation in front
- Empty scene reports zero drag
- Streamline particles advance downstream and recycle at the outlet
- Sphere obstacle deflects particles around it
- Uniform-flow and sphere-density scenes stay bounded (no NaNs/explosions)
- Sphere drag coefficient lands in the physically reasonable range

Run them in Node (no browser needed):

```bash
node test-selftest.mjs
```

Run them in a browser at `?selftest=1` — results print to the console
and render as a green/red badge in the side panel.

## Local development

No build. Clone and open:

```bash
git clone https://github.com/JorgeQuijano/windsurf.git
xdg-open windsurf/index.html   # or just point your browser at it
```

For iteration, run a local server if you want (GitHub Pages parity):

```bash
cd windsurf && python3 -m http.server 8080
# open http://localhost:8080
```

## CI

Every push runs `test-selftest.mjs` in Node on Ubuntu. Green build =
algorithms are still faithful to the Rust reference.

## Why a port?

Rust was correct, fast, and stable — but the rebuild-and-push loop
made rapid UI iteration painful. JS in a single file trades a bit of
peak performance for a sub-second edit → refresh cycle and zero
install friction.

## Credits

Original Rust implementation, geometry, and LBM numerics: Jorge Quijano.
