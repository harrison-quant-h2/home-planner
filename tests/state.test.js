import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSnapshot,
  restoreSnapshot,
  layoutChanged,
  saveSnapshot,
  storageKey,
  History,
} from '../src/state.js';
import { demo, view } from './helpers.js';
test('working edits and repeat resets cannot mutate the saved checkpoint', () => {
  const p = demo(),
    saved = createSnapshot(p, view);
  p.items[0].x += 3;
  p.items.pop();
  assert.equal(layoutChanged(p, saved), true);
  const reset = restoreSnapshot(saved);
  assert.deepEqual(reset.project, demo());
  reset.project.items[0].x = 80;
  reset.view.zoom = 3;
  assert.deepEqual(restoreSnapshot(saved), { project: demo(), view });
});
test('asynchronous save captures click-time state', async () => {
  const p = createSnapshot(demo(), view);
  let finish, written;
  const pending = saveSnapshot(p, async (s) => {
    written = structuredClone(s);
    await new Promise((resolve) => (finish = resolve));
  });
  p.project.items[0].x = 77;
  finish();
  const saved = await pending;
  assert.deepEqual(saved.project, demo());
  assert.deepEqual(saved, written);
});
test('failed persistence retains prior checkpoint', async () => {
  let saved = createSnapshot(demo(), view);
  const before = structuredClone(saved),
    p = demo();
  p.items = [];
  await assert.rejects(async () => {
    saved = await saveSnapshot(createSnapshot(p, view), () => {
      throw Error('quota exceeded');
    });
  }, /quota/);
  assert.deepEqual(saved, before);
});
test('architecture namespaces checkpoints, furniture edits do not', () => {
  const p = demo(),
    key = storageKey(p);
  p.items = [];
  assert.equal(storageKey(p), key);
  p.footprint[1][0] += 1;
  assert.notEqual(storageKey(p), key);
});
test('undo and redo are immutable, bounded, and branch after new changes', () => {
  const h = new History(2),
    p = [{ x: 1 }];
  h.push(p);
  p[0].x = 2;
  assert.deepEqual(h.undo(p), [{ x: 1 }]);
  assert.deepEqual(h.redo([{ x: 1 }]), [{ x: 2 }]);
  h.push([{ x: 3 }]);
  h.push([{ x: 4 }]);
  h.push([{ x: 5 }]);
  assert.equal(h.past.length, 2);
  h.undo([{ x: 6 }]);
  h.push([{ x: 7 }]);
  assert.equal(h.redo([]), null);
});
