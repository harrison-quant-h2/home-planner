import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
);
export function pnpmCommand(args) {
  // pnpm supplies its own JS entry point when launching package scripts. Reuse
  // that runtime for paths containing spaces and Windows command shims.
  const entry = process.env.npm_execpath;
  if (entry && /pnpm\.(?:c?js|mjs)$/.test(entry))
    return [process.execPath, [entry, ...args]];
  if (process.platform === 'win32')
    throw Error(
      'Run through a package script (pnpm agent:doctor/setup/verify) on Windows.',
    );
  return ['pnpm', args];
}
export function prerequisites() {
  const required = manifest.packageManager.split('@')[1],
    checks = [
      {
        name: 'Node.js',
        ok: Number(process.versions.node.split('.')[0]) >= 24,
        actual: process.versions.node,
        expected: '24+',
      },
    ];
  try {
    const [cmd, args] = pnpmCommand(['--version']),
      result = spawnSync(cmd, args, {
        cwd: root,
        encoding: 'utf8',
        timeout: 10000,
      });
    const version = result.stdout?.trim();
    checks.push({
      name: 'pnpm',
      ok: result.status === 0 && version === required,
      actual: version || 'unavailable',
      expected: required,
    });
  } catch {
    checks.push({
      name: 'pnpm',
      ok: false,
      actual: 'unavailable',
      expected: required,
    });
  }
  return { ok: checks.every((c) => c.ok), checks };
}
export function runPnpm(args) {
  const [cmd, argv] = pnpmCommand(args),
    result = spawnSync(cmd, argv, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(
      `pnpm ${args.join(' ')} failed (${result.signal ?? result.status})`,
    );
}
export function requirePrerequisites() {
  const report = prerequisites();
  if (!report.ok) {
    console.error(JSON.stringify(report, null, 2));
    throw Error(
      `Install Node 24+ and pnpm ${manifest.packageManager.split('@')[1]}, then retry. See README.md.`,
    );
  }
}
