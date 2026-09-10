import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { deskScreens } from './geometry.js';

let seed = 73;
function rnd() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}
const mat = (color, roughness = 0.7, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });
export const M = {
  wall: mat('#e8e5de'),
  trim: mat('#faf8f1', 0.45),
  cabinet: mat('#e5e3dc', 0.45),
  steel: mat('#a2a8aa', 0.27, 0.8),
  black: mat('#22282a', 0.4, 0.5),
  wood: mat('#855f3e', 0.65),
  porcelain: mat('#f6f4ee', 0.2),
  glass: new T.MeshPhysicalMaterial({
    color: '#e1eced',
    transparent: true,
    opacity: 0.16,
    roughness: 0.03,
    metalness: 0.1,
    depthWrite: false,
  }),
  tile: mat('#a99e87', 0.63),
};
function texture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  if (kind === 'grain') {
    g.fillStyle = '#888d8d';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3800; i++) {
      const v = 60 + rnd() * 130;
      g.strokeStyle = `rgba(${v},${v + 2},${v + 3},${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.4 + rnd() * 1.6;
      g.beginPath();
      const x = rnd() * 512,
        y = rnd() * 512;
      g.moveTo(x, y);
      g.bezierCurveTo(
        x + 8,
        y + 30,
        x - 5,
        y + 80,
        x + 3,
        y + 120 + rnd() * 350,
      );
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = rnd() * 512,
        y = rnd() * 512;
      g.strokeStyle = '#444b4b30';
      for (let j = 1; j < 9; j++) {
        g.beginPath();
        g.ellipse(x, y, j * 2.4, j * 15, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else if (kind === 'stone') {
    g.fillStyle = '#f0eee8';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(104,105,104,${0.08 + rnd() * 0.14})`;
      g.lineWidth = 0.2 + rnd() * 1.6;
      g.beginPath();
      let x = rnd() * 512,
        y = -20;
      g.moveTo(x, y);
      while (y < 540) {
        x += rnd() * 65 - 27;
        y += 20 + rnd() * 28;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else {
    g.fillStyle = '#d5cebd';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i += 3) {
      g.strokeStyle = i % 2 ? '#9a918a36' : '#faf8eb60';
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 512);
      g.moveTo(0, i);
      g.lineTo(512, i);
      g.stroke();
    }
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const stone = texture('stone'),
  weave = texture('weave');
M.quartz = new T.MeshStandardMaterial({
  map: stone,
  roughness: 0.22,
  color: '#ffffff',
});
export function box(parent, w, h, d, x, y, z, material, r = 0) {
  const geom = r
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3))
    : new T.BoxGeometry(w, h, d);
  const m = new T.Mesh(geom, material);
  m.position.set(x, y, z);
  m.castShadow = !material.transparent;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(parent, r1, r2, h, x, y, z, material, n = 24) {
  const m = new T.Mesh(new T.CylinderGeometry(r1, r2, h, n), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function ellipsoid(parent, x, y, z, sx, sy, sz, material) {
  const m = new T.Mesh(new T.SphereGeometry(1, 20, 12), material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function tube(parent, points, r, material) {
  const m = new T.Mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      20,
      r,
      8,
      false,
    ),
    material,
  );
  parent.add(m);
  m.castShadow = true;
  return m;
}
export function label(parent, text, x, y, z, size = 1.7) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(247,246,240,.93)';
  g.beginPath();
  g.roundRect(2, 3, 636, 74, 24);
  g.fill();
  g.fillStyle = '#444e48';
  g.font = '500 28px -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 320, 42);
  const tx = new T.CanvasTexture(c);
  const s = new T.Sprite(
    new T.SpriteMaterial({ map: tx, depthTest: false, transparent: true }),
  );
  s.position.set(x, y, z);
  s.scale.set(size * 5.3, size * 0.66, 1);
  s.renderOrder = 20;
  parent.add(s);
  return s;
}
export function makeFurniture(item) {
  const g = new T.Group();
  g.name = item.name;
  g.userData = {
    furnitureId: item.id,
    type: item.type,
    dimensionsInches: { width: item.w, depth: item.d, height: item.h },
    planningParameters: structuredClone(item),
    ...(item.type === 'murphy'
      ? {
          open: item.open,
          openProjectionInches: item.openDepth,
          dimensionReference: item.source,
        }
      : {}),
  };
  const w = item.w / 12,
    d = item.d / 12,
    h = item.h / 12;
  const fabric = new T.MeshStandardMaterial({
    color: item.color,
    map: weave,
    roughness: 0.96,
    bumpMap: weave,
    bumpScale: 0.012,
  });
  const wood = mat(item.color, 0.52),
    black = M.black;
  const legs = (ww, dd, yy, hh, mm = M.wood) => {
    for (const x of [-ww / 2, ww / 2])
      for (const z of [-dd / 2, dd / 2])
        box(g, 0.11, hh, 0.11, x, yy, z, mm, 0.02);
  };
  switch (item.type) {
    case 'embody': {
      const frame = mat('#242c31', 0.45),
        seatY = h * 0.426,
        baseRadius = Math.min(w, d) / 2 - 0.145;
      for (let j = 0; j < 5; j++) {
        const angle = (j * Math.PI * 2) / 5 + 0.2,
          x = Math.sin(angle) * baseRadius,
          z = Math.cos(angle) * baseRadius;
        tube(
          g,
          [
            [0, 0.43, 0],
            [x * 0.65, 0.29, z * 0.65],
            [x, 0.23, z],
          ],
          0.048,
          frame,
        );
        box(g, 0.11, 0.16, 0.11, x, 0.2, z, frame, 0.02);
        for (const side of [-1, 1]) {
          const wheel = cyl(
            g,
            0.104,
            0.104,
            0.065,
            x + side * 0.055,
            0.104,
            z,
            black,
            16,
          );
          wheel.rotation.z = Math.PI / 2;
        }
      }
      cyl(g, 0.1, 0.13, seatY - 0.4, 0, (seatY + 0.4) / 2, 0, frame);
      cyl(g, 0.14, 0.16, 0.16, 0, 0.44, 0, frame);
      box(g, w * 0.74, 0.1, d * 0.65, 0, seatY - 0.13, 0.06, frame, 0.08);
      box(g, w * 0.72, 0.2, d * 0.62, 0, seatY, 0.1, fabric, 0.12);
      const bh = h - seatY - 0.07,
        bw = w * 0.65,
        shape = new T.Shape();
      shape.moveTo(-bw * 0.47, 0);
      shape.quadraticCurveTo(-bw * 0.57, bh * 0.14, -bw * 0.35, bh * 0.43);
      shape.quadraticCurveTo(-bw * 0.3, bh * 0.59, -bw * 0.36, bh * 0.81);
      shape.quadraticCurveTo(-bw * 0.38, bh, -bw * 0.2, bh);
      shape.lineTo(bw * 0.2, bh);
      shape.quadraticCurveTo(bw * 0.38, bh, bw * 0.36, bh * 0.81);
      shape.quadraticCurveTo(bw * 0.3, bh * 0.59, bw * 0.35, bh * 0.43);
      shape.quadraticCurveTo(bw * 0.57, bh * 0.14, bw * 0.47, 0);
      shape.closePath();
      const back = new T.Mesh(
        new T.ExtrudeGeometry(shape, {
          depth: 0.1,
          bevelEnabled: true,
          bevelThickness: 0.025,
          bevelSize: 0.025,
          bevelSegments: 3,
          steps: 1,
          curveSegments: 12,
        }),
        fabric,
      );
      back.position.set(0, seatY + 0.04, -d * 0.29);
      back.castShadow = back.receiveShadow = true;
      g.add(back);
      tube(
        g,
        [
          [0, seatY - 0.3, -0.3],
          [0, seatY + 0.2, -d * 0.36],
          [0, h * 0.72, -d * 0.38],
          [0, h - 0.06, -d * 0.34],
        ],
        0.055,
        frame,
      );
      for (let j = 0; j < 9; j++) {
        const y = seatY + 0.13 + (j * (bh - 0.25)) / 9,
          span = bw * (0.43 - 0.13 * Math.sin((j / 8) * Math.PI));
        tube(
          g,
          [
            [-span, y, -d * 0.31],
            [0, y - 0.055, -d * 0.38],
            [span, y, -d * 0.31],
          ],
          0.021,
          frame,
        );
      }
      for (const side of [-1, 1]) {
        const x = side * (w / 2 - 0.18);
        tube(
          g,
          [
            [side * w * 0.3, seatY - 0.18, 0],
            [x, seatY + 0.13, -0.1],
            [x, seatY + 0.65, 0.06],
          ],
          0.052,
          frame,
        );
        box(g, 0.3, 0.13, 0.75, x, seatY + 0.72, 0.1, black, 0.07);
      }
      cyl(g, 0.1, 0.1, 0.13, 0.4, seatY - 0.24, 0.12, black);
      break;
    }
    case 'tv': {
      const center = item.mountHeight / 12,
        extension = item.extension / 12;
      box(g, 0.7, 0.9, 0.07, 0, center, 0.045, black, 0.025);
      // Two visible bracket links connect the fixed wall plate to the swivel pivot.
      tube(
        g,
        [
          [0, center, 0.08],
          [0.28, center, extension * 0.52],
          [0, center, extension - 0.08],
        ],
        0.05,
        M.steel,
      );
      const screen = new T.Group();
      screen.position.set(0, center, extension);
      screen.rotation.y = (item.swivel * Math.PI) / 180;
      g.add(screen);
      box(screen, w, h, d - 0.02, 0, 0, -0.01, black, 0.045);
      const screenMat = new T.MeshStandardMaterial({
        color: '#172a32',
        roughness: 0.25,
        metalness: 0.2,
        emissive: '#10202a',
        emissiveIntensity: 0.22,
      });
      box(
        screen,
        w - 0.1,
        h - 0.1,
        0.008,
        0,
        0,
        d / 2 - 0.006,
        screenMat,
        0.035,
      );
      box(
        screen,
        0.28,
        0.016,
        0.008,
        0,
        -h / 2 + 0.018,
        d / 2 - 0.005,
        M.steel,
      );
      break;
    }
    case 'sectional': {
      const s = item.seatDepth / 12,
        side = item.returnSide === 'left' ? -1 : 1;
      box(g, w, 0.55, s, 0, 0.55, -d / 2 + s / 2, fabric, 0.12);
      box(g, s, 0.55, d - s, (side * (w - s)) / 2, 0.55, s / 2, fabric, 0.12);
      box(g, w, h - 0.55, 0.4, 0, (h + 0.55) / 2, -d / 2 + 0.2, fabric, 0.14);
      box(
        g,
        0.4,
        h - 0.55,
        d,
        side * (w / 2 - 0.2),
        (h + 0.55) / 2,
        0,
        fabric,
        0.14,
      );
      box(
        g,
        0.38,
        h * 0.58,
        s,
        -side * (w / 2 - 0.19),
        h * 0.42,
        -d / 2 + s / 2,
        fabric,
        0.13,
      );
      box(
        g,
        s,
        h * 0.58,
        0.35,
        (side * (w - s)) / 2,
        h * 0.42,
        d / 2 - 0.175,
        fabric,
        0.13,
      );
      const count = Math.max(2, Math.round((w - 0.8) / 2.5)),
        cw = (w - 0.8) / count;
      for (let j = 0; j < count; j++) {
        const x = -w / 2 + 0.4 + (j + 0.5) * cw;
        box(
          g,
          cw - 0.04,
          0.42,
          s - 0.62,
          x,
          1.035,
          -d / 2 + s / 2 + 0.1,
          fabric,
          0.14,
        );
        box(
          g,
          cw - 0.04,
          h * 0.48,
          0.32,
          x,
          h * 0.69,
          -d / 2 + 0.56,
          fabric,
          0.13,
        );
      }
      const extra = d - s - 0.35,
        n = Math.max(1, Math.round(extra / 2.4));
      for (let j = 0; j < n; j++) {
        const z = -d / 2 + s + ((j + 0.5) * extra) / n;
        box(
          g,
          s - 0.55,
          0.42,
          extra / n - 0.04,
          side * ((w - s) / 2 - 0.1),
          1.035,
          z,
          fabric,
          0.13,
        );
        box(
          g,
          0.33,
          h * 0.48,
          extra / n - 0.03,
          side * (w / 2 - 0.57),
          h * 0.69,
          z,
          fabric,
          0.13,
        );
      }
      for (const [x, z] of [
        [-w / 2 + 0.25, -d / 2 + 0.25],
        [w / 2 - 0.25, -d / 2 + 0.25],
        [side * (w / 2 - 0.25), d / 2 - 0.25],
        [side * (w / 2 - s + 0.25), d / 2 - 0.25],
      ])
        box(g, 0.14, 0.3, 0.14, x, 0.15, z, M.wood, 0.025);
      const accent = new T.MeshStandardMaterial({
        color: '#a28f75',
        map: weave,
        roughness: 1,
      });
      box(
        g,
        0.8,
        0.85,
        0.28,
        -side * w * 0.26,
        1.65,
        -d / 2 + 1.0,
        accent,
        0.13,
      );
      break;
    }
    case 'recliner': {
      const rear = item.rearClearance / 12,
        front = item.openDepth / 12 - d - rear;
      box(g, w - 0.35, 0.35, d - 0.4, 0, 0.3, 0, black, 0.06);
      box(g, w - 0.45, 0.78, d - 0.45, 0, 0.85, 0, fabric, 0.18);
      box(g, w - 0.8, 0.4, d * 0.62, 0, 1.47, 0.18, fabric, 0.16);
      for (const x of [-w / 2 + 0.2, w / 2 - 0.2])
        box(g, 0.4, 1.12, d * 0.83, x, 1.5, 0.02, fabric, 0.18);
      const back = new T.Group();
      back.position.set(0, 1.4, -d / 2 + 0.4);
      back.rotation.x = item.open ? -0.61 : -0.07;
      g.add(back);
      box(back, w - 0.5, h - 1.4, 0.46, 0, (h - 1.4) / 2, 0, fabric, 0.18);
      box(back, w - 0.8, 0.65, 0.16, 0, (h - 1.4) * 0.75, 0.25, fabric, 0.12);
      if (item.open) {
        const max = d / 2 + front;
        box(g, w - 0.7, 0.3, max - 0.7, 0, 1.21, (max + 0.7) / 2, fabric, 0.14);
        for (const x of [-0.55, 0.55])
          tube(
            g,
            [
              [x, 0.5, 0.7],
              [x, 1, max - 0.25],
            ],
            0.035,
            black,
          );
      } else box(g, w - 0.7, 0.65, 0.24, 0, 0.86, d / 2 - 0.14, fabric, 0.13);
      box(g, 0.07, 0.42, 0.12, w / 2 - 0.045, 1.0, -0.12, M.wood, 0.03);
      break;
    }
    case 'murphy': {
      // The cabinet anchor stays fixed as the horizontal queen projects into the room.
      const t = 0.065,
        back = -d / 2,
        front = back + item.openDepth / 12;
      box(g, w, h, t, 0, h / 2, back + t / 2, wood);
      for (const x of [-w / 2 + t / 2, w / 2 - t / 2])
        box(g, t, h, d, x, h / 2, 0, wood);
      box(g, w, t, d, 0, h - t / 2, 0, wood);
      box(g, w, 0.16, d, 0, 0.08, 0, wood);
      if (!item.open) {
        for (const x of [-w / 4, w / 4]) {
          box(
            g,
            w / 2 - 0.055,
            h - 0.25,
            t,
            x,
            h / 2 + 0.03,
            d / 2 - t / 2,
            wood,
            0.025,
          );
          box(
            g,
            0.36,
            0.035,
            0.045,
            x,
            h * 0.72,
            d / 2 - 0.005,
            M.black,
            0.015,
          );
        }
        if (item.workDepth) {
          const dw = item.deskW / 12,
            dd = item.deskD / 12,
            dh = item.deskH / 12,
            df = back + item.workDepth / 12;
          box(g, dw, 0.065, dd, 0, dh - 0.0325, df - dd / 2, wood, 0.02);
          for (const x of [-dw / 2 + 0.13, dw / 2 - 0.13]) {
            box(
              g,
              0.09,
              dh - 0.065,
              0.09,
              x,
              (dh - 0.065) / 2,
              df - 0.16,
              M.black,
              0.025,
            );
            tube(
              g,
              [
                [x, dh - 0.14, df - 0.18],
                [x, dh - 0.14, d / 2],
                [x, dh + 0.4, d / 2],
              ],
              0.035,
              M.black,
            );
          }
        }
      } else {
        const projection = item.openDepth / 12,
          center = (back + front) / 2;
        box(g, w - 0.12, 0.14, projection, 0, 0.9, center, wood, 0.035);
        for (const x of [-w / 2 + 0.25, w / 2 - 0.25])
          box(g, 0.09, 0.83, 0.09, x, 0.415, front - 0.15, M.black);
        const mw = Math.min(80 / 12, w - 0.22),
          md = Math.min(60 / 12, projection - 0.22),
          mz = front - 0.13 - md / 2;
        const linen = new T.MeshStandardMaterial({
          color: '#f4eee4',
          map: weave,
          roughness: 0.98,
        });
        box(g, mw, 0.68, md, 0, 1.31, mz, linen, 0.13);
        const head = item.headEnd === 'positive' ? 1 : -1;
        box(
          g,
          mw * 0.73,
          0.08,
          md + 0.03,
          -head * mw * 0.13,
          1.69,
          mz,
          fabric,
          0.045,
        );
        if (!item.headboardConcept || item.headboardRaised)
          for (const z of [mz - md * 0.24, mz + md * 0.24])
            box(
              g,
              1.55,
              0.25,
              md * 0.39,
              head * (mw / 2 - 0.93),
              1.82,
              z,
              linen,
              0.13,
            );
        box(
          g,
          0.95,
          0.05,
          md + 0.05,
          -head * mw * 0.27,
          1.76,
          mz,
          new T.MeshStandardMaterial({
            color: '#6f8178',
            map: weave,
            roughness: 1,
          }),
          0.025,
        );
        if (item.headboardConcept) {
          // End-support concept only. No load capacity or closed-cabinet compatibility is asserted.
          const hx = head * (w / 2 - 0.15),
            pad = mat('#bdb2a0', 0.95),
            headboard = new T.Group();
          headboard.name =
            'Folding end headboard CONCEPT - manufacturer compatibility unverified';
          headboard.userData = {
            conceptOnly: true,
            clearanceAndLoadRatingVerified: false,
          };
          g.add(headboard);
          if (item.headboardRaised) {
            box(headboard, 2 / 12, 2, md, hx, 2.65, mz, pad, 0.055);
            for (const z of [mz - md * 0.35, mz + md * 0.35])
              box(headboard, 0.08, 0.68, 0.08, hx, 1.31, z, M.steel, 0.025);
            for (const z of [mz - md * 0.25, mz, mz + md * 0.25])
              box(
                headboard,
                0.012,
                1.65,
                0.014,
                hx - head * 0.085,
                2.65,
                z,
                linen,
                0.005,
              );
          } else box(headboard, 2, 2 / 12, md, hx - head, 1.75, mz, pad, 0.055);
        }
        if (item.workDepth) {
          // Illustrative stay-level tabletop below the bed, not a mechanism simulation.
          const dd = item.deskD / 12;
          box(
            g,
            item.deskW / 12,
            0.065,
            dd,
            0,
            0.32,
            front - dd / 2 - 0.08,
            wood,
            0.02,
          );
        }
      }
      break;
    }
    case 'sofa':
    case 'chair': {
      legs(w - 0.5, d - 0.5, 0.23, 0.46);
      box(g, w, 0.45, d, 0, 0.6, 0, fabric, 0.14);
      box(g, w, h - 0.75, 0.4, 0, (h + 0.75) / 2, -d / 2 + 0.2, fabric, 0.13);
      for (const x of [-w / 2 + 0.18, w / 2 - 0.18])
        box(g, 0.36, h * 0.63, d - 0.1, x, h * 0.44, 0, fabric, 0.12);
      const n = item.type === 'sofa' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        let x = -w / 2 + 0.4 + ((i + 0.5) * (w - 0.8)) / n;
        box(g, (w - 0.86) / n, 0.36, d - 0.55, x, 1.02, 0.13, fabric, 0.13);
        let cushion = box(
          g,
          (w - 0.87) / n,
          h * 0.52,
          0.36,
          x,
          h * 0.66,
          -d / 2 + 0.55,
          fabric,
          0.12,
        );
        cushion.rotation.x = -0.1;
      }
      if (item.type === 'sofa') {
        const p = box(
          g,
          0.75,
          0.8,
          0.24,
          -w * 0.32,
          1.55,
          0.0,
          new T.MeshStandardMaterial({
            color: '#95816a',
            map: weave,
            roughness: 1,
          }),
          0.12,
        );
        p.rotation.z = 0.24;
      }
      break;
    }
    case 'bed': {
      legs(w - 0.45, d - 0.45, 0.2, 0.4);
      box(g, w, 0.65, d, 0, 0.61, 0, fabric, 0.13);
      box(g, w, h, 0.3, 0, h / 2, -d / 2 + 0.15, fabric, 0.13);
      const mw = item.mattressW ? item.mattressW / 12 : w - 0.22,
        md = item.mattressD ? item.mattressD / 12 : d - 0.2;
      box(
        g,
        mw,
        0.68,
        md,
        0,
        1.22,
        0.02,
        new T.MeshStandardMaterial({
          color: '#f5f0e7',
          map: weave,
          roughness: 0.96,
        }),
        0.16,
      );
      box(g, mw + 0.03, 0.13, md * 0.64, 0, 1.6, md * 0.15, fabric, 0.09);
      for (const x of [-mw * 0.235, mw * 0.235])
        box(g, mw * 0.4, 0.3, 1.55, x, 1.75, -md * 0.3, M.trim, 0.17);
      box(
        g,
        mw + 0.04,
        0.06,
        1.6,
        0,
        1.7,
        md * 0.27,
        new T.MeshStandardMaterial({
          color: '#7f8880',
          map: weave,
          roughness: 1,
        }),
        0.035,
      );
      break;
    }
    case 'rug':
      box(
        g,
        w,
        h,
        d,
        0,
        h / 2 + 0.028,
        0,
        new T.MeshStandardMaterial({
          color: item.color,
          map: weave,
          bumpMap: weave,
          bumpScale: 0.025,
          roughness: 1,
        }),
        0.025,
      );
      break;
    case 'coffee': {
      const top = cyl(g, 1, 1, 0.15, 0, h - 0.08, 0, wood, 48);
      top.scale.set(w / 2, 1, d / 2);
      const base = cyl(g, 0.5, 0.7, h - 0.16, 0, (h - 0.16) / 2, 0, wood);
      base.scale.set(w / 2, 1, d / 2);
      box(g, 0.65, 0.055, 0.48, 0, h + 0.02, 0, M.trim, 0.01);
      cyl(g, 0.18, 0.14, 0.35, w * 0.22, h + 0.17, 0, M.porcelain);
      break;
    }
    case 'desk':
    case 'dining': {
      box(g, w, 0.16, d, 0, h - 0.08, 0, wood, 0.05);
      legs(w - 0.4, d - 0.4, (h - 0.16) / 2, h - 0.16, black);
      if (item.type === 'desk') {
        if (item.tvMonitorIn) {
          for (const m of deskScreens(item)) {
            const display = new T.Group();
            display.name = m.role;
            display.position.set(m.x, m.y, m.z);
            display.rotation.y = (m.rot * Math.PI) / 180;
            g.add(display);
            box(display, m.w, m.h, 0.09, 0, 0, 0, black, 0.025);
            const isGuest = /guest|TV/.test(m.role);
            const screenMat = new T.MeshStandardMaterial({
              color: isGuest ? '#32483c' : '#283e4b',
              emissive: isGuest ? '#1c3329' : '#152733',
              emissiveIntensity: 0.7,
              roughness: 0.45,
            });
            box(
              display,
              m.w - 0.06,
              m.h - 0.06,
              0.008,
              0,
              0,
              0.05,
              screenMat,
              0.009,
            );
            const accent = mat(isGuest ? '#b4baa0' : '#748f9b', 0.8);
            if (isGuest) {
              box(display, m.w * 0.55, 0.05, 0.008, 0, 0, 0.059, accent, 0.01);
              box(
                display,
                m.w * 0.3,
                0.025,
                0.008,
                0,
                -0.11,
                0.059,
                accent,
                0.005,
              );
            } else
              for (let col = 0; col < 3; col++)
                box(
                  display,
                  (m.w - 0.22) / 3,
                  0.022,
                  0.008,
                  -m.w / 3 + (col * m.w) / 3,
                  m.h * 0.25,
                  0.059,
                  accent,
                  0.003,
                );
            const ax = m.role.includes('ultrawide') ? 0 : isGuest ? 1.4 : -1.4,
              az = -d * 0.38;
            box(g, 0.24, 0.1, 0.24, ax, h + 0.025, az, black, 0.025);
            tube(
              g,
              [
                [ax, h + 0.06, az],
                [ax, m.y - 0.2, az],
                [m.x - 0.2, m.y - 0.1, az + 0.15],
                [m.x, m.y, m.z - 0.08],
              ],
              0.047,
              black,
            );
          }
        } else {
          box(g, 1.8, 1.1, 0.08, 0, h + 0.85, -d * 0.18, black, 0.04);
          box(g, 0.15, 0.55, 0.1, 0, h + 0.28, -d * 0.18, black);
          box(g, 0.65, 0.04, 0.4, 0, h + 0.025, -d * 0.18, black);
        }
        box(g, 1.15, 0.04, 0.4, 0, h + 0.025, d * 0.23, M.trim, 0.03);
      }
      break;
    }
    case 'console':
    case 'nightstand': {
      legs(w - 0.3, d - 0.3, 0.24, 0.48, black);
      box(g, w, h - 0.35, d, 0, (h + 0.35) / 2, 0, wood, 0.045);
      const n = item.type === 'console' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        box(
          g,
          w / n - 0.05,
          h - 0.52,
          0.03,
          -w / 2 + ((i + 0.5) * w) / n,
          (h + 0.35) / 2,
          d / 2 + 0.025,
          wood,
          0.02,
        );
        box(
          g,
          0.32,
          0.04,
          0.08,
          -w / 2 + ((i + 0.5) * w) / n,
          h * 0.7,
          d / 2 + 0.07,
          black,
        );
      }
      break;
    }
    case 'stool':
      legs(w - 0.4, d - 0.4, h * 0.31, h * 0.62, black);
      box(g, w, 0.22, d, 0, h * 0.69, 0, wood, 0.13);
      box(g, w, h * 0.27, 0.18, 0, h * 0.87, -d / 2 + 0.09, wood, 0.07);
      box(g, w - 0.4, 0.055, 0.06, 0, 0.85, d / 2 - 0.2, black);
      break;
    case 'plant': {
      cyl(g, w * 0.4, w * 0.29, h * 0.31, 0, h * 0.155, 0, mat('#c1b39f'), 32);
      cyl(g, w * 0.34, w * 0.34, 0.025, 0, h * 0.31, 0, mat('#514639'));
      for (let i = 0; i < 13; i++) {
        const a = i * 2.399,
          hh = h * (0.48 + (0.48 * (i % 5)) / 5),
          x = Math.cos(a) * w * 0.3,
          z = Math.sin(a) * d * 0.3;
        tube(
          g,
          [
            [0, h * 0.24, 0],
            [x * 0.4, hh * 0.8, z * 0.4],
            [x, hh, z],
          ],
          0.025,
          M.wood,
        );
        const leaf = ellipsoid(
          g,
          x,
          hh,
          z,
          w * 0.14,
          h * 0.15,
          d * 0.045,
          mat(item.color, 0.84),
        );
        leaf.rotation.set(0.2, a, Math.sin(a) * 0.6);
      }
      break;
    }
    default:
      box(g, w, h, d, 0, h / 2, 0, wood, 0.04);
  }
  g.position.set(item.x, 0, item.z);
  g.rotation.y = (item.rot * Math.PI) / 180;
  g.traverse((o) => {
    o.userData.furnitureId = item.id;
  });
  return g;
}

/** Shared procedural textures/materials live for the app lifetime; per-mesh resources do not. */
export function disposeGroup(group) {
  const shared = new Set(Object.values(M)),
    geometries = new Set(),
    materials = new Set();
  group.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!shared.has(m)) materials.add(m);
        if (o.isSprite) m.map?.dispose();
      }
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}
