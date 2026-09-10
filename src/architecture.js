import * as T from 'three';
import { M, box, label } from './furniture.js';
import { wallSegments, doorZones } from './geometry.js';

export function projectBounds(project) {
  const xs = project.footprint.map((p) => p[0]),
    zs = project.footprint.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    w: maxX - minX,
    d: maxZ - minZ,
  };
}
export function buildHouse(project) {
  const root = new T.Group(),
    architecture = new T.Group(),
    ceiling = new T.Group(),
    labels = new T.Group(),
    caps = new T.Group();
  root.name = project.name;
  architecture.name = 'Walls and openings';
  ceiling.name = 'Ceiling';
  root.add(architecture, ceiling);
  const shape = new T.Shape(
    project.footprint.map(([x, z]) => new T.Vector2(x, -z)),
  );
  const floor = new T.Mesh(
    new T.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false }),
    new T.MeshStandardMaterial({ color: '#b9a38b', roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  floor.name = 'Floor';
  root.add(floor);
  const roof = new T.Mesh(
    new T.ShapeGeometry(shape),
    new T.MeshStandardMaterial({ color: '#f0ede5', side: T.DoubleSide }),
  );
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = project.ceilingHeight;
  ceiling.add(roof);
  const blockers = project.walls.flatMap((w) =>
    wallSegments(w, project.ceilingHeight),
  );
  for (const s of blockers) {
    const m = box(
      architecture,
      s.w,
      s.high - s.low,
      s.d,
      s.x,
      (s.low + s.high) / 2,
      s.z,
      M.wall,
    );
    m.rotation.y = (s.rot * Math.PI) / 180;
  }
  for (const wall of project.walls) {
    const r = -Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0]);
    const group = new T.Group();
    group.position.set(wall.a[0], 0, wall.a[1]);
    group.rotation.y = r;
    architecture.add(group);
    for (const o of wall.openings) {
      if (o.kind === 'window') {
        box(
          group,
          o.width,
          o.height,
          0.025,
          o.at,
          o.sill + o.height / 2,
          0,
          M.glass,
        );
        for (const sign of [-1, 1]) {
          box(
            group,
            0.08,
            o.height + 0.08,
            wall.thickness + 0.06,
            o.at + (sign * o.width) / 2,
            o.sill + o.height / 2,
            0,
            M.trim,
          );
          box(
            group,
            o.width,
            0.08,
            wall.thickness + 0.06,
            o.at,
            o.sill + ((sign + 1) * o.height) / 2,
            0,
            M.trim,
          );
        }
        box(
          group,
          0.06,
          o.height,
          0.07,
          o.at,
          o.sill + o.height / 2,
          0,
          M.trim,
        );
      }
    }
  }
  for (const f of project.fixtures) {
    const m = box(
      root,
      f.w,
      f.high - f.low,
      f.d,
      f.x,
      (f.low + f.high) / 2,
      f.z,
      new T.MeshStandardMaterial({ color: f.color, roughness: 0.6 }),
      0.035,
    );
    m.rotation.y = (f.rot * Math.PI) / 180;
    m.name = f.name;
  }
  for (const r of project.rooms)
    label(labels, r.name.toUpperCase(), r.x, 0.3, r.z, 1.2);
  function capWalls(height) {
    for (const child of caps.children) child.geometry.dispose();
    caps.clear();
    for (const s of blockers.filter(
      (s) => s.low <= height && s.high > height,
    )) {
      const m = box(caps, s.w, 0.025, s.d, s.x, height, s.z, M.wall);
      m.rotation.y = (s.rot * Math.PI) / 180;
    }
  }
  return {
    root,
    architecture,
    ceiling,
    labels,
    caps,
    capWalls,
    blockers: [...blockers, ...project.fixtures],
    doorZones: project.walls.flatMap(doorZones),
  };
}
