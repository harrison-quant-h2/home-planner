---
name: home-planner-verify
description: Verify a Home Planner change before handoff or publication, or diagnose a failing repository check. Use for evidence-backed validation; do not publish or change unrelated code merely to make checks green.
---

# Verify Home Planner

1. Read root `AGENTS.md` and inspect the diff. Choose checks based on what changed.
2. Run `pnpm agent:doctor` if runtime readiness is unknown. Set up dependencies with `pnpm agent:setup` when needed. Browser installation is a separate explicit command: `pnpm exec playwright install chromium` (Linux may require `--with-deps`).
3. For JavaScript, geometry, state, or tooling, run focused Node tests, then `pnpm check`. For documentation-only edits, check formatting, links, and diff whitespace.
4. For rendering or browser behavior, run `pnpm agent:verify`. It builds first and then tests `dist/`. Inspect affected views manually as well. Do not run against another task's occupied preview server or assume a stale build is current.
5. Validate changed project JSON with `pnpm --silent agent:inspect path/to/file.json`. Report warnings separately from schema validity.
6. Inspect the final diff for private plans, screenshots, generated output, unlicensed assets, or machine-specific paths. Review only the current task's changes.
7. Report passing and failing checks, manual observations, and remaining limits. If publishing is authorized, identify the commit and verify CI on that exact commit; otherwise report the local state.
