import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateProject,
  readProjectFile,
  validView,
} from '../src/validation.js';
import { demo, view } from './helpers.js';
test('example round-trips as a project and snapshot', () => {
  assert.deepEqual(validateProject(demo()), demo());
  assert.deepEqual(
    readProjectFile({
      format: 'home-planner-snapshot',
      version: 1,
      project: demo(),
      view,
    }),
    { project: demo(), view },
  );
});
for (const [name, mutate] of [
  ['unsupported version', (p) => (p.version = 9)],
  ['non-finite dimensions', (p) => (p.items[0].w = Infinity)],
  ['duplicate furniture ids', (p) => (p.items[1].id = p.items[0].id)],
  ['unknown furniture type', (p) => (p.items[0].type = 'script')],
  ['invalid color', (p) => (p.items[0].color = 'url(https://example.com)')],
  [
    'self-crossing floor',
    (p) =>
      (p.footprint = [
        [0, 0],
        [10, 10],
        [0, 10],
        [10, 0],
      ]),
  ],
  [
    'touching boundary',
    (p) =>
      (p.footprint = [
        [0, 0],
        [10, 0],
        [10, 10],
        [5, 0],
        [0, 10],
      ]),
  ],
  [
    'overlapping openings',
    (p) => p.walls[0].openings.push({ ...p.walls[0].openings[0] }),
  ],
  ['opening outside wall', (p) => (p.walls[0].openings[0].at = 0)],
  ['unbounded ceiling', (p) => (p.ceilingHeight = 999)],
  ['missing room camera', (p) => delete p.rooms[0].eye],
  [
    'bad recliner extension',
    (p) => (p.items.find((i) => i.type === 'recliner').openDepth = 1),
  ],
  [
    'oversized scene',
    (p) =>
      (p.items = Array.from({ length: 251 }, (_, n) => ({
        ...p.items[0],
        id: 'item-' + n,
      }))),
  ],
])
  test('rejects ' + name, () => {
    const p = demo();
    mutate(p);
    assert.throws(() => validateProject(p));
  });
test('view validation cannot introduce NaN or huge camera values', () => {
  assert.equal(validView(view), true);
  assert.equal(validView({ ...view, zoom: 0 }), false);
  assert.equal(validView({ ...view, position: [NaN, 0, 0] }), false);
  assert.equal(
    readProjectFile({ ...demo(), view: { ...view, zoom: 999 } }).view,
    null,
  );
});
test('import returns a deep copy', () => {
  const p = demo(),
    copy = validateProject(p);
  copy.walls[0].a[0] = 9;
  assert.notEqual(p.walls[0].a[0], 9);
});

test('the documented minimal project is executable input', async () => {
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(
    new URL('../docs/project-format.md', import.meta.url),
    'utf8',
  );
  const json = text.match(/```json\n([\s\S]*?)\n```/)[1];
  assert.equal(validateProject(JSON.parse(json)).id, 'my-room');
});
