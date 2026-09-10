// Furniture position is always its cabinet/body center. A Murphy bed deploys
// forward from a fixed back edge; opening it must never move its wall anchor.
export function furnitureFootprint(item, open = item.open) {
  if (item.type === 'tv') {
    const r = (item.rot * Math.PI) / 180;
    return {
      ...item,
      x: item.x + (Math.sin(r) * item.extension) / 12,
      z: item.z + (Math.cos(r) * item.extension) / 12,
      w: item.w / 12,
      d: item.d / 12,
      rot: item.rot + item.swivel,
    };
  }
  const depth =
    item.type === 'murphy'
      ? open
        ? item.openDepth
        : (item.workDepth ?? item.d)
      : item.type === 'recliner' && open
        ? item.openDepth
        : item.d;
  const offset =
      (depth - item.d) / 24 -
      (item.type === 'recliner' && open ? item.rearClearance / 12 : 0),
    angle = (item.rot * Math.PI) / 180;
  return {
    ...item,
    x: item.x + Math.sin(angle) * offset,
    z: item.z + Math.cos(angle) * offset,
    w: item.w / 12,
    d: depth / 12,
  };
}
function localPoint(item, x, z) {
  const r = (item.rot * Math.PI) / 180;
  return [
    item.x + x * Math.cos(r) + z * Math.sin(r),
    item.z - x * Math.sin(r) + z * Math.cos(r),
  ];
}
export function deskMonitorPose(item) {
  const guest = item.tvMonitorMode === 'guest',
    diagonal = item.tvMonitorIn ?? 27;
  return {
    x: Math.min(
      guest ? 1.7 : 1.45,
      item.w / 24 - (diagonal * 16) / Math.sqrt(337) / 24 - 0.15,
    ),
    z: (-item.d / 12) * 0.12,
    y: item.h / 12 + 32 / 12,
    rot: guest ? 6 : 0,
    w: (diagonal * 16) / Math.sqrt(337) / 12 + 0.08,
    h: (diagonal * 9) / Math.sqrt(337) / 12 + 0.08,
  };
}
export function deskScreens(item) {
  if (!item.tvMonitorIn)
    return [
      {
        x: 0,
        z: (-item.d / 12) * 0.18,
        y: item.h / 12 + 0.85,
        w: 1.8,
        h: 1.1,
        rot: 0,
        role: 'Desktop monitor',
      },
    ];
  const screen = (inches, aspect, x, y, role) => ({
    w: (inches * aspect) / Math.hypot(aspect, 1) / 12 + 0.08,
    h: inches / Math.hypot(aspect, 1) / 12 + 0.08,
    x,
    y: item.h / 12 + y / 12,
    z: (-item.d / 12) * 0.12,
    rot: 0,
    role,
  });
  const lower =
    item.monitorLayout === 'quad'
      ? [
          screen(34, 21 / 9, -1.38, 14, '34-inch ultrawide'),
          screen(34, 21 / 9, 1.38, 14, '34-inch ultrawide'),
        ]
      : [screen(34, 21 / 9, 0, 14, '34-inch ultrawide')];
  const auxiliary = screen(27, 16 / 9, -1.35, 32, '27-inch auxiliary monitor');
  return [
    ...lower,
    auxiliary,
    ...(item.monitorLayout === 'wall'
      ? []
      : [
          {
            ...deskMonitorPose(item),
            role:
              item.tvMonitorIn === 32
                ? '32-inch TV option'
                : '27-inch guest monitor',
          },
        ]),
  ];
}
export function furnitureFootprints(item, open = item.open) {
  const low = item.type === 'tv' ? (item.mountHeight - item.h / 2) / 12 : 0,
    high =
      item.type === 'tv' ? (item.mountHeight + item.h / 2) / 12 : item.h / 12;
  if (item.type === 'desk')
    return [
      { ...furnitureFootprint(item), low, high },
      ...deskScreens(item).map((m) => {
        const p = localPoint(item, m.x, m.z);
        return {
          x: p[0],
          z: p[1],
          w: m.w,
          d: 0.1,
          rot: item.rot + m.rot,
          low: m.y - m.h / 2,
          high: m.y + m.h / 2,
        };
      }),
    ];
  if (item.type !== 'sectional')
    return [{ ...furnitureFootprint(item, open), low, high }];
  const w = item.w / 12,
    d = item.d / 12,
    s = item.seatDepth / 12,
    side = item.returnSide === 'left' ? -1 : 1;
  return [
    [0, -d / 2 + s / 2, w, s],
    [(side * (w - s)) / 2, s / 2, s, d - s],
  ].map(([x, z, ww, dd]) => {
    const p = localPoint(item, x, z);
    return { x: p[0], z: p[1], w: ww, d: dd, rot: item.rot, low, high };
  });
}
export function furnitureOutline(item) {
  if (item.type !== 'sectional') return footprint(furnitureFootprint(item));
  const w = item.w / 24,
    d = item.d / 24,
    s = item.seatDepth / 12,
    side = item.returnSide === 'left' ? -1 : 1;
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [w - s, d],
    [w - s, -d + s],
    [-w, -d + s],
  ].map(([x, z]) => localPoint(item, x * side, z));
}
export function itemsOverlap(a, b, padding = 0) {
  return furnitureFootprints(a).some((x) =>
    furnitureFootprints(b).some(
      (y) => x.high > y.low && y.high > x.low && overlap(x, y, padding),
    ),
  );
}
// Oriented rectangle intersection. Used for visible fit warnings, not a furniture delivery guarantee.
export function footprint(o) {
  const w = o.w / 2,
    d = o.d / 2,
    a = ((o.rot || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-w, -d],
    [w, -d],
    [w, d],
    [-w, d],
  ].map(([x, z]) => [o.x + x * c + z * s, o.z - x * s + z * c]);
}
export function overlap(a, b, padding = 0) {
  const ap = footprint({ ...a, w: a.w + padding * 2, d: a.d + padding * 2 }),
    bp = footprint(b);
  for (const p of [ap, bp])
    for (let i = 0; i < 4; i++) {
      const next = p[(i + 1) % 4],
        axis = [-(next[1] - p[i][1]), next[0] - p[i][0]];
      const aa = ap.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        bb = bp.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      if (
        Math.max(...aa) <= Math.min(...bb) ||
        Math.max(...bb) <= Math.min(...aa)
      )
        return false;
    }
  return true;
}

const EPS = 1e-7;
export function pointInPolygon([x, z], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[j],
      [bx, bz] = polygon[i];
    if (
      Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) < EPS &&
      x >= Math.min(ax, bx) - EPS &&
      x <= Math.max(ax, bx) + EPS &&
      z >= Math.min(az, bz) - EPS &&
      z <= Math.max(az, bz) + EPS
    )
      return true;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}
/** Split each furniture edge at every boundary intersection, including vertices.
 * Test every resulting interval so a short concave cutout cannot be skipped. */
export function insidePolygon(item, polygon) {
  const corners = footprint(item);
  if (!corners.every((p) => pointInPolygon(p, polygon))) return false;
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  return corners.every((a, i) => {
    const b = corners[(i + 1) % 4],
      r = [b[0] - a[0], b[1] - a[1]],
      length = r[0] ** 2 + r[1] ** 2,
      breaks = [0, 1];
    for (let j = 0; j < polygon.length; j++) {
      const c = polygon[j],
        d = polygon[(j + 1) % polygon.length],
        s = [d[0] - c[0], d[1] - c[1]],
        q = [c[0] - a[0], c[1] - a[1]],
        denom = cross(r, s);
      if (Math.abs(denom) > EPS) {
        const t = cross(q, s) / denom,
          u = cross(q, r) / denom;
        if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS)
          breaks.push(Math.max(0, Math.min(1, t)));
      } else if (Math.abs(cross(q, r)) < EPS)
        for (const p of [c, d]) {
          const t = ((p[0] - a[0]) * r[0] + (p[1] - a[1]) * r[1]) / length;
          if (t > 0 && t < 1) breaks.push(t);
        }
    }
    breaks.sort((x, y) => x - y);
    return breaks.slice(1).every((end, j) => {
      const t = (breaks[j] + end) / 2;
      return pointInPolygon([a[0] + r[0] * t, a[1] + r[1] * t], polygon);
    });
  });
}
export function wallSegments(wall, ceilingHeight) {
  const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]),
    angle = Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0]);
  const segments = [];
  const add = (left, right, low, high) => {
    if (right - left > EPS && high - low > EPS)
      segments.push({
        name: wall.name ?? 'Wall',
        x: wall.a[0] + (Math.cos(angle) * (left + right)) / 2,
        z: wall.a[1] + (Math.sin(angle) * (left + right)) / 2,
        w: right - left,
        d: wall.thickness,
        rot: (-angle * 180) / Math.PI,
        low,
        high,
      });
  };
  let start = 0;
  for (const o of [...wall.openings].sort((a, b) => a.at - b.at)) {
    add(start, o.at - o.width / 2, 0, ceilingHeight);
    add(o.at - o.width / 2, o.at + o.width / 2, 0, o.sill);
    add(
      o.at - o.width / 2,
      o.at + o.width / 2,
      o.sill + o.height,
      ceilingHeight,
    );
    start = o.at + o.width / 2;
  }
  add(start, length, 0, ceilingHeight);
  return segments;
}
export function doorZones(wall) {
  const angle = Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0]);
  return wall.openings
    .filter((o) => o.kind === 'door')
    .map((o) => ({
      name: 'Door approach',
      x: wall.a[0] + Math.cos(angle) * o.at,
      z: wall.a[1] + Math.sin(angle) * o.at,
      w: o.width,
      d: 4,
      rot: (-angle * 180) / Math.PI,
    }));
}
export function assessItem(item, items, project) {
  const parts = furnitureFootprints(item),
    warnings = [];
  const collision = (p, b) => p.high > b.low && b.high > p.low && overlap(p, b);
  if (parts.some((p) => !insidePolygon(p, project.footprint)))
    warnings.push('Outside the floor boundary');
  if (parts.some((p) => p.high > project.ceilingHeight))
    warnings.push('Above the ceiling');
  const blockers = [
    ...project.walls.flatMap((w) => wallSegments(w, project.ceilingHeight)),
    ...project.fixtures,
  ];
  if (parts.some((p) => blockers.some((b) => collision(p, b))))
    warnings.push('Overlaps a wall or fixed fixture');
  if (
    item.type !== 'rug' &&
    items.some(
      (i) => i.id !== item.id && i.type !== 'rug' && itemsOverlap(item, i),
    )
  )
    warnings.push('Overlaps another piece');
  if (
    parts.some((p) =>
      project.walls.some((w) => doorZones(w).some((z) => overlap(p, z))),
    )
  )
    warnings.push('Check door approach');
  return warnings;
}
