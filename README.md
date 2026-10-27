# Windsurf

Real-time 3D CFD wind-tunnel simulator that runs in your browser.
Single HTML file, no build step.

👉 **<https://jorgequijano.github.io/windsurf/>**

Powered by a D3Q19 Lattice Boltzmann solver with a WebGPU compute
backend and a WebGL2 + CPU fallback. Hosted on GitHub Pages.

## Rendering modes

- **three.js scene (default)** — a transparent second WebGL canvas is
  stacked over the volumetric canvas. The test artifact is drawn as a
  lit PBR mesh (ACES filmic tone mapping, hemisphere + key/fill/rim
  studio rig, environment reflections, cyan edge glow) and the flow
  lines are GPU geometry that is depth-occluded by the artifact
  (lines passing behind the obstacle are hidden correctly). The
  ray-marched volume, smoke layer, slice plane, surface forces and
  all physics run exactly as before on the canvas below. The three.js
  module is loaded from a CDN; if it is unavailable (offline / CDN
  failure) the app silently falls back to the legacy renderer.
  Append `?three=0` to force the legacy renderer.
- **Legacy renderer (`?three=0`)** — the original hand-rolled WebGL2
  line + solid-cube pass over the volumetric canvas.

Known three.js-mode limits (r58 prototype): ribbon mode renders as
plain streamlines, and the WebGPU backend still shows no volumetric
(its readback pipeline is broken upstream of this change).

Works on desktop and mobile: phones get a full-screen canvas, a
thumb-friendly control dock, and a swipe-away bottom sheet, while the
simulation automatically switches to a lighter lattice and render budget.

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
- **ThreeJsSceneLayer** — optional lit PBR artifact and depth-occluded flow lines on a transparent overlay (`?three=0` disables)
- **SelfTestHarness** — 112 in-browser assertions covering the solver, geometry, and UI
- **MobileTouchUI** — full-screen canvas, glass HUD, bottom-sheet controls, and a 5-button thumb dock
- **TouchCamera** — one-finger orbit, two-finger pinch dolly, tap-to-open help tooltips
- **AdaptiveQuality** — phones run a 24×16×16 lattice, 64-step ray-march, 48 streamlines, and a 30 fps default budget

## Live Demo

Open the URL in **Chrome / Edge** for the fastest path (WebGPU).
**Safari** and **Firefox** fall back to the CPU solver + WebGL2 renderer.
On a phone, open the same URL, then **Add to Home Screen** for a
standalone full-screen experience.

Append `?selftest=1` to run the validation suite in the console.
Append `?cpu=1` to force the CPU fallback for comparison.
Append `?mobile=1` to force the lighter mobile solver profile on a
desktop browser (`?desktop=1` forces the desktop profile).

## Controls

| Input | Action |
|---|---|
| Mouse drag / one-finger drag | Orbit camera |
| Mouse wheel / two-finger pinch | Dolly in / out |
| `R` | Reset camera |
| `1`–`4` | Camera presets (TopDown, SideOn, Iso, WakeView) |
| `Play` | Run the solver continuously |
| `Step` | Advance one LBM step |
| `Reset` | Reset the field |

### Mobile

| Input | Action |
|---|---|
| Drag the canvas | Orbit |
| Pinch the canvas | Zoom |
| Tap the dock | Pause / Step / Reset / Views / Controls |
| Swipe the sheet header down | Dismiss the controls sheet |
| Tap a `?` badge | Open its help tooltip (tap elsewhere to dismiss) |

The bottom sheet groups controls into **Sim**, **Visual**, **Scene**, and
**Data** tabs so the common settings are never more than one tap away.

## Performance

| Backend | Frame Rate | Notes |
|---|---|---|
| WebGPU compute | 30–60 fps | Chrome / Edge on a recent GPU |
| WebGL2 + CPU (desktop) | 2–5 fps | Safari, Firefox |
| WebGL2 + CPU (mobile profile) | 15–30 fps | 24×16×16 lattice, 64-step ray-march |
| CPU JS only | 1–3 fps | Headless / low-power devices |

Phones automatically select the mobile profile. If the frame rate is
still low, open **Controls → Visual** and lower the streamline count or
disable smoke, or open **Data** and drop the frame budget to 15 fps.

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

One hundred and twelve in-browser assertions cover the solver, geometry, and UI:

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
- **ThreeJsSceneLayer** — Active overlay renders triangles, obstacle transform matches the solver, and streamline geometry populates
- **MobileChrome** — Top HUD, thumb dock, bottom sheet, tabs, and view popover are present in the DOM
- **MobileCss** — Phone media query, `touch-action: none`, dynamic viewport height, safe-area insets, tab filtering
- **MobileGestures** — Pointer camera, pinch dolly, adaptive lattice/raymarch budget, visual-viewport resize handling
- **MobileWiring** — Dock play/step/reset/controls actions share state with the desktop buttons
- **MeshLayouts** — The artifact mesh survives a real rotation matrix, the cube call site passes `t.rotation`, and every non-cube shape uses the 7-float pos/normal/faceId layout

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

To test the phone layout on a desktop, open DevTools → Device
Toolbar and pick any phone (≤900px wide). `?mobile=1` additionally
forces the lighter mobile solver profile, which is useful for
benchmarking without a physical device.

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
- **MobileFirstControls** — below 900px the side panel becomes a
  bottom sheet; the canvas keeps the full viewport and touch gestures
  are handled with pointer events (`touch-action: none` on the canvas).
- **AdaptiveCost** — the mobile profile lowers the lattice, ray-march
  samples, streamline count, and default frame budget. Every value
  remains user-adjustable from the sheet.
- **SafeAreaAware** — the HUD, dock, sheet, and tooltips respect
  `env(safe-area-inset-*)` so notches and home indicators don't cover
  controls.

## License

Single-author project. Original implementation, geometry, and LBM
numerics: Jorge Quijano.
