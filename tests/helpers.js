import { readFileSync } from 'node:fs';
export function demo() {
  return JSON.parse(
    readFileSync(
      new URL('../public/examples/courtyard.json', import.meta.url),
      'utf8',
    ),
  );
}
export const view = {
  mode: 'plan',
  activeRoom: 'living',
  position: [18, 200, 14],
  target: [18, 0, 14],
  zoom: 1,
  walkAngle: 0,
  walkPitch: 0,
};
