import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  footprint,
  overlap,
  insidePolygon,
  furnitureFootprint,
  furnitureFootprints,
  itemsOverlap,
  wallSegments,
  assessItem,
} from '../src/geometry.js';
import { CATALOG } from '../src/catalog.js';
import { demo } from './helpers.js';
const rectangle = (x, z, w, d, rot = 0) => ({ x, z, w, d, rot });
const piece = (type) => ({
  ...CATALOG.find((i) => i.type === type),
  id: type,
  x: 0,
  z: 0,
  rot: 0,
});
test('rotation swaps rectangle dimensions', () => {
  const p = footprint(rectangle(10, 10, 8, 3, 90));
  assert.equal(
    Math.max(...p.map((a) => a[0])) - Math.min(...p.map((a) => a[0])),
    3,
  );
  assert.equal(
    Math.max(...p.map((a) => a[1])) - Math.min(...p.map((a) => a[1])),
    8,
  );
});
test('SAT rejects overlapping bounding boxes when rotated bodies are separate', () => {
  const a = rectangle(0, 0, 8, 1, 45);
  assert.equal(overlap(a, rectangle(1, 1, 8, 1, 45)), false);
  assert.equal(overlap(a, rectangle(0.25, 0.25, 8, 1, 45)), true);
});
test('touching is distinct from overlapping; clearance can add padding', () => {
  assert.equal(overlap(rectangle(0, 0, 2, 2), rectangle(2, 0, 2, 2)), false);
  assert.equal(
    overlap(rectangle(0, 0, 2, 2), rectangle(2, 0, 2, 2), 0.1),
    true,
  );
});
test('concave boundary rejects furniture spanning a notch with all corners inside', () => {
  const floor = [
    [0, 0],
    [10, 0],
    [10, 10],
    [6, 10],
    [6, 4],
    [4, 4],
    [4, 10],
    [0, 10],
  ];
  assert.equal(insidePolygon(rectangle(5, 7, 8, 2), floor), false);
  assert.equal(insidePolygon(rectangle(5, 2, 8, 2), floor), true);
});
test('Murphy rear anchor stays fixed across deployment for every quarter turn', () => {
  for (const rot of [0, 90, 180, 270]) {
    const i = { ...piece('murphy'), rot };
    const closed = furnitureFootprint(i, false),
      open = furnitureFootprint(i, true),
      r = (rot * Math.PI) / 180;
    assert.ok(
      Math.abs(
        closed.x -
          (Math.sin(r) * closed.d) / 2 -
          (open.x - (Math.sin(r) * open.d) / 2),
      ) < 1e-8,
    );
    assert.ok(
      Math.abs(
        closed.z -
          (Math.cos(r) * closed.d) / 2 -
          (open.z - (Math.cos(r) * open.d) / 2),
      ) < 1e-8,
    );
  }
});
test('sectional empty corner does not collide as a filled rectangle', () => {
  const s = piece('sectional'),
    small = { ...piece('box'), x: 2, z: 2, w: 12, d: 12 };
  assert.equal(itemsOverlap(s, small), false);
  small.x = -4;
  assert.equal(itemsOverlap(s, small), true);
});
test('TV above a low cabinet is not a furniture overlap', () => {
  const tv = piece('tv'),
    box = { ...piece('box'), x: 0, z: 1, h: 24 };
  assert.equal(itemsOverlap(tv, box), false);
  box.h = 80;
  assert.equal(itemsOverlap(tv, box), true);
});
test('desk monitors contribute height and their own footprint', () => {
  const d = piece('desk');
  assert.equal(furnitureFootprints(d).length, 4);
  assert.ok(furnitureFootprints(d).some((p) => p.high > 5));
});
test('openings preserve the wall above and below without filling the doorway', () => {
  const w = {
    a: [0, 0],
    b: [10, 0],
    thickness: 0.5,
    openings: [{ at: 5, width: 3, height: 7, sill: 0 }],
  };
  const blocks = wallSegments(w, 9);
  assert.equal(blocks.length, 3);
  assert.equal(blocks.filter((b) => b.low === 0).length, 2);
  assert.deepEqual(
    blocks.find((b) => b.low === 7),
    { name: 'Wall', x: 5, z: 0, w: 3, d: 0.5, rot: -0, low: 7, high: 9 },
  );
});
test('demo guest bed fits with desk and parked chair at its initial location', () => {
  const p = demo(),
    bed = p.items.find((i) => i.id === 'desk-bed');
  bed.open = true;
  bed.officeMode = 'guest';
  assert.deepEqual(assessItem(bed, p.items, p), []);
});
test('fit check detects both fixture collision and outside boundary', () => {
  const p = demo(),
    item = { ...piece('box'), x: 25, z: 26.5 };
  assert.ok(
    assessItem(item, [], p).includes('Overlaps a wall or fixed fixture'),
  );
  item.x = -20;
  assert.ok(assessItem(item, [], p).includes('Outside the floor boundary'));
});

test('concave intersections exactly at polygon vertices do not skip a short notch', () => {
  const floor = [
    [0, 0],
    [10, 0],
    [10, 10],
    [8, 10],
    [8, 8],
    [7, 7],
    [6, 8],
    [6, 10],
    [0, 10],
  ];
  assert.equal(insidePolygon(rectangle(5, 6, 8, 4), floor), false);
  assert.equal(insidePolygon(rectangle(5, 4, 8, 4), floor), true);
});
test('a default desk screen contributes height even without monitor options', () => {
  const desk = piece('desk');
  delete desk.tvMonitorIn;
  const parts = furnitureFootprints(desk);
  assert.equal(parts.length, 2);
  assert.ok(parts[1].high > desk.h / 12 + 1);
});
