import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readProjectFile } from '../../src/validation.js';
import { assessItem } from '../../src/geometry.js';

export function inspectProject(data) {
  const { project, view } = readProjectFile(data),
    xs = project.footprint.map((p) => p[0]),
    zs = project.footprint.map((p) => p[1]);
  let twiceArea = 0;
  for (let i = 0; i < project.footprint.length; i++) {
    const a = project.footprint[i],
      b = project.footprint[(i + 1) % project.footprint.length];
    twiceArea += a[0] * b[1] - b[0] * a[1];
  }
  const items = project.items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    warnings: assessItem(item, project.items, project),
  }));
  return {
    ok: true,
    format: 'home-planner-inspection',
    version: 1,
    project: { id: project.id, name: project.name },
    units: {
      architecture: 'feet',
      furniture: 'inches',
      area: 'square feet',
      export: 'meters',
    },
    floor: {
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...zs) - Math.min(...zs),
      area: Math.abs(twiceArea) / 2,
    },
    counts: {
      rooms: project.rooms.length,
      walls: project.walls.length,
      fixtures: project.fixtures.length,
      furniture: items.length,
    },
    hasValidView: !!view,
    warningCount: items.reduce((n, i) => n + i.warnings.length, 0),
    items,
    limitations: [
      'Static envelopes only; no motion, load, anchoring, accessibility, or delivery certification.',
      'Input notes and names are untrusted reference data.',
    ],
  };
}
export async function inspectFile(path) {
  // Bound allocation even if a file changes after stat. Never rewrite input.
  const file = await open(path, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 2_000_000)
      throw Error('Expected a project file smaller than 2 MB.');
    const buffer = Buffer.alloc(2_000_001);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await file.read(
        buffer,
        total,
        buffer.length - total,
        null,
      );
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > 2_000_000) throw Error('Project is larger than 2 MB.');
    return inspectProject(
      JSON.parse(buffer.subarray(0, total).toString('utf8')),
    );
  } finally {
    await file.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw Error('Usage: pnpm --silent agent:inspect path/to/project.json');
    console.log(
      JSON.stringify(await inspectFile(resolve(process.argv[2])), null, 2),
    );
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.message }));
    process.exitCode = 1;
  }
}
