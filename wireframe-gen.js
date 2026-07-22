// Wireframe geometry generators. Each returns a Float32Array of XYZ vertices
// suitable for gl.LINES rendering (every 2 vertices = 1 line).
// Obstacle shapes here mirror those in index.html's obstacle* factories.
// Coordinates are in obstacle-LOCAL space (before transform). Caller applies
// the obstacle's transform.position/scale/rotation when uploading uniforms.

function generateBoxEdges(halfExtents) {
  const hx = halfExtents.x, hy = halfExtents.y, hz = halfExtents.z;
  const v = [
    [-hx, -hy, -hz], [+hx, -hy, -hz], [+hx, +hy, -hz], [-hx, +hy, -hz],
    [-hx, -hy, +hz], [+hx, -hy, +hz], [+hx, +hy, +hz], [-hx, +hy, +hz],
  ];
  const e = [
    // bottom rectangle
    [0,1],[1,2],[2,3],[3,0],
    // top rectangle
    [4,5],[5,6],[6,7],[7,4],
    // vertical edges
    [0,4],[1,5],[2,6],[3,7],
  ];
  const out = [];
  for (const [a,b] of e) { out.push(...v[a], ...v[b]); }
  return new Float32Array(out);
}

// Icosphere with N subdivisions. Returns line edges.
function generateIcosphereLines(subdivisions = 1) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0]/l, v[1]/l, v[2]/l];
  };
  verts = verts.map(norm);
  let faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  const midpointCache = new Map();
  function midpoint(a, b) {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (midpointCache.has(k)) return midpointCache.get(k);
    const va = verts[a], vb = verts[b];
    const m = norm([(va[0]+vb[0])/2, (va[1]+vb[1])/2, (va[2]+vb[2])/2]);
    const idx = verts.length;
    verts.push(m);
    midpointCache.set(k, idx);
    return idx;
  }
  for (let s = 0; s < subdivisions; s++) {
    const newFaces = [];
    for (const [a,b,c] of faces) {
      const ab = midpoint(a,b), bc = midpoint(b,c), ca = midpoint(c,a);
      newFaces.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    faces = newFaces;
  }
  // Edges = unique unordered pairs from faces
  const edgeSet = new Set();
  for (const [a,b,c] of faces) {
    edgeSet.add(`${Math.min(a,b)}_${Math.max(a,b)}`);
    edgeSet.add(`${Math.min(b,c)}_${Math.max(b,c)}`);
    edgeSet.add(`${Math.min(c,a)}_${Math.max(c,a)}`);
  }
  const out = [];
  for (const k of edgeSet) {
    const [a,b] = k.split('_').map(Number);
    out.push(...verts[a], ...verts[b]);
  }
  return new Float32Array(out);
}

function generateCylinderLines(radius, halfHeight, segments = 24) {
  const out = [];
  const yLo = -halfHeight, yHi = +halfHeight;
  // bottom circle
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i+1) / segments) * Math.PI * 2;
    out.push(Math.cos(a0)*radius, yLo, Math.sin(a0)*radius);
    out.push(Math.cos(a1)*radius, yLo, Math.sin(a1)*radius);
  }
  // top circle
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i+1) / segments) * Math.PI * 2;
    out.push(Math.cos(a0)*radius, yHi, Math.sin(a0)*radius);
    out.push(Math.cos(a1)*radius, yHi, Math.sin(a1)*radius);
  }
  // connecting lines (4 of them, cardinal directions)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x = Math.cos(a)*radius, z = Math.sin(a)*radius;
    out.push(x, yLo, z, x, yHi, z);
  }
  return new Float32Array(out);
}

function generateTorusLines(major, minor, segments = 48, ringSegs = 12) {
  const out = [];
  // segments rings around the main axis
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i+1) / segments) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    for (let j = 0; j < ringSegs; j++) {
      const b0 = (j / ringSegs) * Math.PI * 2;
      const b1 = ((j+1) / ringSegs) * Math.PI * 2;
      const r0 = major + minor * Math.cos(b0);
      const r1 = major + minor * Math.cos(b1);
      const y0 = minor * Math.sin(b0);
      const y1 = minor * Math.sin(b1);
      // segment 0->1 on big circle
      out.push(c0*r0, y0, s0*r0, c1*r1, y1, s1*r1);
      // segment 0->1 around ring
      out.push(c0*r0, y0, s0*r0, c0*r1, y1, s0*r1);
    }
  }
  return new Float32Array(out);
}

// Apply transform.position/scale/rotation to a local XYZ array, in place.
function applyTransform(localXYZ, position, scale, rotation) {
  // rotation is a 3x3 row-major matrix; we transform (x,y,z) by M*v
  const n = localXYZ.length / 3;
  for (let i = 0; i < n; i++) {
    const x = localXYZ[i*3], y = localXYZ[i*3+1], z = localXYZ[i*3+2];
    // apply scale
    const sx = x * scale.x, sy = y * scale.y, sz = z * scale.z;
    // apply rotation (rotation is row-major 3x3, flatten=[m00,m01,m02,m10,...])
    const rx = rotation[0]*sx + rotation[1]*sy + rotation[2]*sz;
    const ry = rotation[3]*sx + rotation[4]*sy + rotation[5]*sz;
    const rz = rotation[6]*sx + rotation[7]*sy + rotation[8]*sz;
    // translate
    localXYZ[i*3]   = rx + position.x;
    localXYZ[i*3+1] = ry + position.y;
    localXYZ[i*3+2] = rz + position.z;
  }
  return localXYZ;
}

// Build a single Float32Array of all obstacles' world-space edges.
function buildObstacleLines(obstacles) {
  const parts = [];
  for (const o of obstacles) {
    let local;
    if (o.shape === 'sphere') {
      local = generateIcosphereLines(1);
    } else if (o.shape === 'box') {
      local = generateBoxEdges(o.transform.scale);
    } else if (o.shape === 'cylinder') {
      local = generateCylinderLines(o.transform.scale.x, o.transform.scale.y, 24);
    } else if (o.shape === 'torus') {
      local = generateTorusLines(o.transform.scale.x, o.transform.scale.y);
    } else {
      console.warn('Unknown obstacle shape:', o.shape);
      continue;
    }
    applyTransform(local, o.transform.position, {x:1,y:1,z:1}, o.transform.rotation);
    parts.push(local);
  }
  let total = 0;
  for (const p of parts) total += p.length;
  const merged = new Float32Array(total);
  let off = 0;
  for (const p of parts) { merged.set(p, off); off += p.length; }
  return merged;
}

if (typeof module !== 'undefined') {
  module.exports = { generateBoxEdges, generateIcosphereLines, generateCylinderLines, generateTorusLines, applyTransform, buildObstacleLines };
}
