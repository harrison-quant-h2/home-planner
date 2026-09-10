import { FURNITURE_TYPES } from './catalog.js';
function validExtras(i) {
  if (i.type === 'desk' && i.tvMonitorIn !== undefined)
    return (
      Number.isFinite(i.tvMonitorIn) &&
      [27, 32].includes(i.tvMonitorIn) &&
      ['triple', 'quad', 'wall'].includes(i.monitorLayout) &&
      ['work', 'guest'].includes(i.tvMonitorMode)
    );
  if (
    i.type === 'murphy' &&
    i.headboardConcept !== undefined &&
    (!(
      i.headboardConcept === true &&
      ['positive', 'negative'].includes(i.headEnd) &&
      typeof i.headboardRaised === 'boolean'
    ) ||
      (!i.open && i.headboardRaised))
  )
    return false;
  if (i.type === 'murphy' && i.workDepth !== undefined)
    return (
      ['workDepth', 'deskW', 'deskD', 'deskH'].every((k) =>
        Number.isFinite(i[k]),
      ) &&
      i.workDepth >= i.d + i.deskD &&
      i.workDepth <= i.openDepth &&
      i.deskW > 0 &&
      i.deskW <= i.w &&
      i.deskD > 0 &&
      i.deskH >= 20 &&
      i.deskH < i.h &&
      ['work', 'maker', 'guest'].includes(i.officeMode) &&
      i.open === (i.officeMode === 'guest')
    );
  if (i.type === 'sectional')
    return (
      Number.isFinite(i.seatDepth) &&
      i.seatDepth >= 12 &&
      i.seatDepth < Math.min(i.w, i.d) &&
      ['left', 'right'].includes(i.returnSide)
    );
  if (i.type === 'recliner')
    return (
      typeof i.open === 'boolean' &&
      Number.isFinite(i.openDepth) &&
      i.openDepth >= i.d &&
      i.openDepth <= 360 &&
      Number.isFinite(i.rearClearance) &&
      i.rearClearance >= 0 &&
      i.rearClearance <= i.openDepth - i.d
    );
  if (i.type === 'tv')
    return (
      Number.isFinite(i.mountHeight) &&
      i.mountHeight >= i.h / 2 &&
      i.mountHeight <= 120 &&
      Number.isFinite(i.extension) &&
      i.extension >= 3 &&
      i.extension <= 36 &&
      Number.isFinite(i.swivel) &&
      Math.abs(i.swivel) <= 75
    );
  if (
    i.type === 'bed' &&
    (i.mattressW !== undefined || i.mattressD !== undefined)
  )
    return (
      Number.isFinite(i.mattressW) &&
      Number.isFinite(i.mattressD) &&
      i.mattressW >= 12 &&
      i.mattressW <= i.w &&
      i.mattressD >= 12 &&
      i.mattressD <= i.d
    );
  return true;
}
export function validItems(a) {
  return (
    Array.isArray(a) &&
    a.length <= 250 &&
    a.every(
      (i) =>
        i &&
        validExtras(i) &&
        typeof i.id === 'string' &&
        /^[a-zA-Z0-9_-]{1,80}$/.test(i.id) &&
        typeof i.name === 'string' &&
        i.name.length <= 100 &&
        FURNITURE_TYPES.includes(i.type) &&
        /^#[0-9a-f]{6}$/i.test(i.color) &&
        ['w', 'd', 'h', 'x', 'z', 'rot'].every((k) => Number.isFinite(i[k])) &&
        i.w >= 1 &&
        i.w <= 360 &&
        i.d >= 1 &&
        i.d <= 360 &&
        i.h >= 0.5 &&
        i.h <= 144 &&
        Math.abs(i.x) < 200 &&
        Math.abs(i.z) < 200 &&
        Math.abs(i.rot) <= 3600 &&
        (i.type !== 'murphy' ||
          (typeof i.open === 'boolean' &&
            Number.isFinite(i.openDepth) &&
            i.openDepth >= i.d &&
            i.openDepth <= 360)),
    ) &&
    new Set(a.map((i) => i.id)).size === a.length
  );
}

const bounded = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const text = (s, max = 120) =>
  typeof s === 'string' && s.length > 0 && s.length <= max;
const id = (s) => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s);
const point = (p) =>
  Array.isArray(p) && p.length === 2 && p.every((n) => bounded(n, -150, 150));
const vector = (p) =>
  Array.isArray(p) && p.length === 3 && p.every((n) => bounded(n, -500, 500));
export function validateProject(p) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (!p || p.format !== 'home-planner' || p.version !== 1)
    fail('Expected a home-planner version 1 project.');
  if (!id(p.id) || !text(p.name) || p.units !== 'feet')
    fail('Project needs an id, name, and units: feet.');
  if (!bounded(p.ceilingHeight, 7, 20))
    fail('Ceiling height must be between 7 and 20 feet.');
  if (
    !Array.isArray(p.footprint) ||
    p.footprint.length < 3 ||
    p.footprint.length > 64 ||
    !p.footprint.every(point)
  )
    fail('Provide 3–64 floor boundary points.');
  // Reject repeated vertices and touching/crossing edges, including collinear overlaps.
  const poly = p.footprint;
  const cross = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const on = (a, b, c) =>
    Math.abs(cross(a, b, c)) < 1e-8 &&
    c[0] >= Math.min(a[0], b[0]) &&
    c[0] <= Math.max(a[0], b[0]) &&
    c[1] >= Math.min(a[1], b[1]) &&
    c[1] <= Math.max(a[1], b[1]);
  const intersect = (a, b, c, d) =>
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    on(a, b, c) ||
    on(a, b, d) ||
    on(c, d, a) ||
    on(c, d, b);
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.1)
      fail('Floor edges must be at least 0.1 feet.');
    area += a[0] * b[1] - b[0] * a[1];
    for (let j = i + 2; j < poly.length; j++) {
      if (i === 0 && j === poly.length - 1) continue;
      if (intersect(a, b, poly[j], poly[(j + 1) % poly.length]))
        fail('Floor boundary must not cross or touch itself.');
    }
  }
  if (Math.abs(area) < 8) fail('Floor area must be at least 4 square feet.');
  if (!Array.isArray(p.walls) || p.walls.length > 200)
    fail('At most 200 walls are supported.');
  for (const w of p.walls) {
    if (
      !w ||
      !point(w.a) ||
      !point(w.b) ||
      !bounded(w.thickness, 0.05, 2) ||
      !Array.isArray(w.openings) ||
      w.openings.length > 16
    )
      fail('Invalid wall.');
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    if (len < 0.1) fail('Wall is too short.');
    let end = 0;
    for (const o of [...w.openings].sort((a, b) => a.at - b.at)) {
      if (
        !o ||
        !bounded(o.at, 0, len) ||
        !bounded(o.width, 0.5, len) ||
        !bounded(o.height, 0.5, p.ceilingHeight) ||
        !bounded(o.sill, 0, p.ceilingHeight - o.height) ||
        !['door', 'window', 'passage'].includes(o.kind) ||
        o.at - o.width / 2 < end - 1e-8 ||
        o.at + o.width / 2 > len + 1e-8
      )
        fail('Opening exceeds its wall or overlaps another opening.');
      end = o.at + o.width / 2;
    }
  }
  if (
    !Array.isArray(p.rooms) ||
    p.rooms.length < 1 ||
    p.rooms.length > 30 ||
    !p.rooms.every(
      (r) =>
        r &&
        id(r.id) &&
        text(r.name) &&
        point([r.x, r.z]) &&
        vector(r.eye) &&
        vector(r.target),
    ) ||
    new Set(p.rooms.map((r) => r.id)).size !== p.rooms.length
  )
    fail('Provide 1–30 rooms with unique ids and camera positions.');
  if (
    !Array.isArray(p.fixtures) ||
    p.fixtures.length > 100 ||
    !p.fixtures.every(
      (f) =>
        f &&
        text(f.name) &&
        point([f.x, f.z]) &&
        bounded(f.w, 0.1, 100) &&
        bounded(f.d, 0.1, 100) &&
        bounded(f.low, 0, p.ceilingHeight) &&
        bounded(f.high, f.low + 0.05, p.ceilingHeight) &&
        bounded(f.rot, -360, 360) &&
        /^#[0-9a-f]{6}$/i.test(f.color),
    )
  )
    fail('Invalid fixed fixture.');
  if (!validItems(p.items))
    fail(
      'Furniture has unsupported types, duplicate ids, or invalid dimensions.',
    );
  if (
    p.notes !== undefined &&
    (!Array.isArray(p.notes) ||
      p.notes.length > 30 ||
      !p.notes.every((n) => text(n, 500)))
  )
    fail('At most 30 short project notes are supported.');
  return structuredClone(p);
}
export function validView(v) {
  return (
    v &&
    ['dollhouse', 'plan', 'walk'].includes(v.mode) &&
    vector(v.position) &&
    vector(v.target) &&
    bounded(v.zoom, 0.05, 50) &&
    bounded(v.walkAngle, -1000, 1000) &&
    bounded(v.walkPitch, -1.5, 1.5)
  );
}
export function readProjectFile(data) {
  const project = validateProject(
    data?.format === 'home-planner-snapshot' ? data.project : data,
  );
  if (data?.format === 'home-planner-snapshot' && data.version !== 1)
    throw new Error('Unsupported snapshot version.');
  return {
    project,
    view: validView(data.view) ? structuredClone(data.view) : null,
  };
}
