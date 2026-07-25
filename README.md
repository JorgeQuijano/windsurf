# Windsurf

Real-time 3D CFD wind-tunnel simulator that runs in your browser.
Single HTML file, no build step, no dependencies.

👉 **<https://jorgequijano.github.io/windsurf/>**

Powered by a D3Q19 Lattice Boltzmann solver with a WebGPU compute
backend and a WebGL2 + CPU fallback. Hosted on GitHub Pages.

## Features

- **LatticeBoltzmannSolver** — D3Q19, bounce-back walls, Smagorinsky LES
- **SixShapeObstacles** — Cube, Sphere, Cylinder, Wedge, Cone, Tetrahedron
- **LiveDragReadout** — Pressure + viscous breakdown, real-time Cd display
- **CdOverTimeStrip** — Rolling 10-second Cd waveform (Karman shedding visible)
- **CdVsWindSpeedPlot** — Scatter Cd as a function of inlet velocity
- **StreamlinesAndPathlines** — RK2 particle integration, burst or continuous
- **RibbonMode** — Streamlines rendered as ribbons (flat strips with width)
- **VolumetricRayMarch** — Density, VelocityMagnitude, VorticityMagnitude, Pressure
- **SlicePlane** — 2D cross-section at the mid-plane
- **SmokeLayer** — Passive scalar with band-pass gate and decay
- **OscillatingInflow** — Sinusoidal gust in 3 axes for Karman vortex streets
- **CameraPresets** — TopDown, SideOn, Iso, WakeView
- **SelfTestHarness** — 79 in-browser assertions covering the solver, geometry, and UI

## Live Demo

Open the URL in **Chrome / Edge** for the fastest path (WebGPU).
**Safari** and **Firefox** fall back to the CPU solver + WebGL2 renderer.

Append `?selftest=1` to run the validation suite in the console.
Append `?cpu=1` to force the CPU fallback for comparison.

## Controls

| Input | Action |
|---|---|
| Mouse drag | Orbit camera |
| Mouse wheel | Dolly in / out |
| `R` | Reset camera |
| `1`–`4` | Camera presets (TopDown, SideOn, Iso, WakeView) |
| `Play` | Run the solver continuously |
| `Step` | Advance one LBM step |
| `Reset` | Reset the field |

## Performance

| Backend | Frame Rate | Notes |
|---|---|---|
| WebGPU compute | 30–60 fps | Chrome / Edge on a recent GPU |
| WebGL2 + CPU | 2–5 fps | Safari, Firefox, mobile |
| CPU JS only | 1–3 fps | Headless / low-power devices |

## Repository Layout

```
windsurf/
├── index.html          The entire app (JS + WGSL + GLSL inline)
├── test-selftest.mjs     Node-based self-test runner
├── wireframe-gen.js      Procedural wireframe generator (utility)
└── README.md
```

The entire app is `index.html`. Edit → push → refresh → see change.
The iteration loop is sub-second on any commit.

## Validation

Seventy-nine in-browser assertions cover the solver, geometry, and UI:

- **LbmInvariants** — D3Q19 weights, lattice indexing, equilibrium function
- **EquilibriumDistribution** — Steady state at t=0
- **SdfObstacles** — All six shapes are negative inside, zero at the surface
- **RelaxationParameter** — τ = ν/cs² + 0.5 in the stable range
- **UniformFlow** — Empty grid stays close to uniform over many steps
- **SphereStagnation** — Measurable flow stagnation in front of the sphere
- **EmptyScene** — Zero drag report
- **ParticleAdvance** — Streamline particles advance downstream and recycle
- **ObstacleDeflection** — Particles divert around the obstacle
- **Boundedness** — No NaNs or explosions in any scene
- **DragCoefficient** — Sphere Cd lands in the physically reasonable range
- **CameraPresets** — All four presets snap to canonical views
- **PathlineModes** — Burst and Continuous behave as configured
- **VolumetricGate** — Vorticity field exceeds the visibility threshold
- **CdOverTimeStrip** — Canvas, source, window constant, buffer cap, animate-loop wiring, trim logic, clear button, draw loop

Run in Node (no browser needed):

```bash
node test-selftest.mjs
```

Run in a browser at `?selftest=1` — results print to the console and
render as a green / red badge in the side panel.

## Local Development

No build. Clone and open:

```bash
git clone https://github.com/JorgeQuijano/windsurf.git
cd windsurf
xdg-open index.html        # Linux
open index.html            # macOS
start index.html           # Windows
```

For iteration with GitHub Pages parity (the recommended path):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## CI

The CI workflow is intentionally **not committed** — the OAuth token
used to push this repo does not carry the `workflow` scope required by
GitHub to add `.github/workflows/*.yml` files. To enable CI:

1. Create `.github/workflows/ci.yml` locally with the standard
   `actions/checkout` + `actions/setup-node` + `node test-selftest.mjs`
   recipe.
2. Push it manually with a token that has the `workflow` scope.

The `selftest` job runs `node test-selftest.mjs` on every push.
A `pages` job deploys `index.html` to GitHub Pages.

## Design Notes

- **Single-file constraint** — the entire app must live in one HTML
  file. WGSL and GLSL are inlined; there are no `import` statements.
- **Sub-second iteration** — the edit → refresh cycle is the design
  centre. Any change that adds a build step is rejected.
- **CpuAndGpuParity** — every feature must work on both backends.
  If `backend.computeDrag` does not exist, the WebGPU path falls
  back to the async `computeDragAsync` feed.
- **LiveUiUpdates** — slider changes use `updateConfig()` rather
  than `backend.reset()` so the wake is preserved across drags.
- **BoundedScale** — `CD_MAX_CLAMP` (8.0) caps transient drag spikes
  so the Cd plots remain readable after a wind-speed change.

## License

Single-author project. Original implementation, geometry, and LBM
numerics: Jorge Quijano.
