---
name: home-planner-change
description: Implement or debug Home Planner application features, geometry, persistence, imports, exports, or UI. Use for code changes in this repository; do not use for furniture-only JSON arrangement work.
---

# Change Home Planner

1. Read root `AGENTS.md`, `package.json`, and the relevant modules and tests. Establish a concrete reproduction or acceptance example using fictional data.
2. Explain the intended behavior and a short plan. Work within the current request; preserve unrelated edits.
3. Keep the implementation in the appropriate layer. Pure geometry, validation, and state must not acquire browser dependencies. Match rendering and fit envelopes, units, anchors, and screen elevations.
4. Add a meaningful regression for changed behavior. For saves, exercise failure and click-time snapshot isolation. For imports, exercise malformed data and plain-text rendering.
5. Use `$home-planner-verify` or its checks. Inspect the affected UI when appearance or interaction changes. Document compatibility or limitations.
6. Review the diff and report the change, verified checks, unresolved assumptions, and Git state. A local result is not a deployed result.

For multi-session work, use `.codex/templates/task-plan.md`. Prefer repository commands to a new ad hoc test harness.
