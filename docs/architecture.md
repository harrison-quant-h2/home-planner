# Architecture

Home Planner is a static ES-module application. Vite develops and bundles it; Three.js renders procedural geometry. There is no application server or network persistence layer.

| Module            | Responsibility                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `main.js`         | CSS entry and graceful renderer-startup failure message.                                                    |
| `app.js`          | DOM controls, camera interaction, local persistence, import/export, and scene lifetime.                     |
| `catalog.js`      | Furniture presets and supported type identifiers.                                                           |
| `validation.js`   | Versioned project, furniture, and camera validation before constructing scenes.                             |
| `geometry.js`     | Pure footprint math, separating-axis collision, polygon containment, wall segmentation, and fit assessment. |
| `architecture.js` | Project-driven floor, ceiling, walls, windows, fixtures, and labels.                                        |
| `furniture.js`    | Procedural furniture meshes, materials, and per-object resource disposal.                                   |
| `state.js`        | Immutable snapshots, architecture storage namespaces, bounded undo/redo.                                    |

## Data flow

```text
project JSON → validate → architecture + furniture → Three.js scene
                                  ↑                       ↓
                               UI edits ← selection / dragging
                                  ↓
                             browser draft
                                  ↓ explicit save
                         immutable saved checkpoint
```

The architecture footprint is a simple polygon, while each wall is an independent centerline with openings. Wall segments include vertical intervals: a TV can be above low furniture, while a desk monitor can collide with a window header. Sectionals use two rectangles, preserving the empty corner. Murphy beds preserve their rear anchor when the footprint extends. Recliner models account for extra projection and rear clearance.

Fit calculations remain approximate. Most furniture is represented by outer envelopes. There is no physics engine, swept-volume solver, structural calculation, or accessibility model. Floor containment checks vertices and every edge interval between boundary intersections to reject shapes spanning a concavity.

## Persistence

Snapshots are deep copies taken before asynchronous persistence. The in-memory checkpoint updates only after its write succeeds. Draft writes never replace it. Storage keys combine a versioned prefix, project id, and a non-cryptographic fingerprint of architecture. This fingerprint provides accidental namespace separation, not a security or content-addressing guarantee.

All import text is rendered through DOM text APIs. Geometry is bounded before scene construction. Input validation and immutable state helpers can be tested without a browser or WebGL.

## Rendering and cleanup

The app uses a clipped cutaway for plan and dollhouse views and complete walls/ceiling in walk-through mode. Furniture thumbnails are rendered once. Replaced meshes dispose their geometries and owned materials; shared procedural textures remain for the app lifetime. Export clones materials to remove view clipping without altering the live scene.

## Tests

Node's built-in runner covers geometry, malformed data, immutable save/reset, failed persistence, and history. Playwright runs against the built static app with Chromium and software WebGL for reproducible CI availability. Browser tests check behavior and export structure; they are not pixel-perfect visual regressions. Inspect visual changes manually as well.
