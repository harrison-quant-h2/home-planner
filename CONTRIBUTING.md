# Contributing

Small, complete changes are easiest to review. For a substantial feature, open an issue describing the user problem and proposed behavior before implementing it. Maintainers do not promise a response deadline.

## Set up

Use Node 24 and pnpm 11.19.0. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. The README has the full quick start. Keep `pnpm-lock.yaml` in sync when changing dependencies. Do not add credentials, personal floor plans, listing images, exports, or generated build files.

## Make a change

1. Reproduce the problem with a small fictional project.
2. Keep geometry and validation pure. Add regression tests for changed behavior, especially units, collision boundaries, persistence, and imports.
3. Keep user-provided strings in `textContent`, never executable HTML. Bound imported geometry before constructing meshes.
4. Preserve the distinction between draft autosave and explicit saved checkpoints.
5. Update user-facing documentation when behavior or the project format changes.

Run `pnpm check`, `pnpm exec playwright install chromium`, and `pnpm test:e2e`. On Linux, add `--with-deps` to the browser install if needed. Build first; browser tests exercise `dist/`. Check the affected view manually as well: screenshots do not prove collision correctness, and unit tests do not prove visual quality.

For the README screenshot, run `UPDATE_DOCS=1 pnpm test:e2e --grep 'renders the fictional home'` on macOS/Linux after building. This intentionally captures the clean fictional example, never a local saved home.

## Pull requests

Describe the concrete problem, resulting behavior, verification performed, and any remaining limitations. Include screenshots for visual changes and a minimal project for geometry bugs. Keep unrelated cleanup separate. Do not replace a project-format version without an explicit compatibility strategy.

By contributing, you agree that your contribution is available under the repository's MIT license. Include the applicable license and provenance for any third-party asset. Procedural shapes or clearly licensed assets are preferred.
