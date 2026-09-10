import { requirePrerequisites, runPnpm } from './runtime.mjs';
try {
  requirePrerequisites();
  runPnpm(['install', '--frozen-lockfile']);
  runPnpm(['build']);
  console.log(
    'Home Planner is ready. Run pnpm dev; install Chromium separately if browser tests are needed.',
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
