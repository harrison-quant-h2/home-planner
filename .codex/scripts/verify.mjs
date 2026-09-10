import { requirePrerequisites, runPnpm } from './runtime.mjs';
try {
  requirePrerequisites();
  runPnpm(['check']);
  runPnpm(['test:e2e']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
