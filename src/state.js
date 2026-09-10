import { readProjectFile } from './validation.js';
export function createSnapshot(project, view) {
  return {
    format: 'home-planner-snapshot',
    version: 1,
    savedAt: new Date().toISOString(),
    project: structuredClone(project),
    view: structuredClone(view),
  };
}
export async function saveSnapshot(snapshot, persist) {
  const captured = structuredClone(snapshot);
  await persist(captured);
  return captured;
}
export function restoreSnapshot(snapshot) {
  return readProjectFile(snapshot);
}
export function layoutChanged(project, checkpoint) {
  return (
    !checkpoint ||
    JSON.stringify(project) !== JSON.stringify(checkpoint.project)
  );
}
export function storageKey(project) {
  // Architecture changes cannot silently restore a checkpoint from a different floor plan.
  const { items: _items, ...architecture } = project;
  let hash = 2166136261;
  for (const char of JSON.stringify(architecture))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `home-planner:v1:${project.id}:${(hash >>> 0).toString(16)}`;
}
export class History {
  constructor(limit = 40) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  push(value) {
    this.past.push(structuredClone(value));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current) {
    if (!this.past.length) return null;
    this.future.push(structuredClone(current));
    return this.past.pop();
  }
  redo(current) {
    if (!this.future.length) return null;
    this.past.push(structuredClone(current));
    return this.future.pop();
  }
}
