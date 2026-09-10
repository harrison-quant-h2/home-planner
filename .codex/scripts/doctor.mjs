import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root, prerequisites } from './runtime.mjs';
const report = prerequisites();
report.dependenciesInstalled = existsSync(
  join(root, 'node_modules', 'vite', 'package.json'),
);
report.nextStep = !report.ok
  ? 'Install the required runtime from README.md.'
  : report.dependenciesInstalled
    ? 'pnpm check'
    : 'pnpm agent:setup';
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
