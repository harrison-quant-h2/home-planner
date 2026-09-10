# Project format — version 1

A project is JSON data. It does not contain scripts, remote textures, or imported meshes. Use **Project → Open project** to load it. For a complete furnished example, copy [`courtyard.json`](../public/examples/courtyard.json). The authoritative validation rules are in [`src/validation.js`](../src/validation.js).

## Coordinates and units

| Value                                           | Convention                                       |
| ----------------------------------------------- | ------------------------------------------------ |
| Floor polygon, walls, room positions, fixtures  | Feet                                             |
| Furniture `x`, `z`                              | Feet                                             |
| Furniture `w`, `d`, `h` and optional dimensions | Inches                                           |
| Rotation                                        | Degrees; positive turns local +Z toward world +X |
| Elevation                                       | Y up; ground level is 0                          |
| Floor-plan view                                 | X right, Z down; no geographic north implied     |
| Exported GLB                                    | Geometry scaled by 0.3048 to meters              |

Most furniture positions refer to the center of its closed body. A TV position refers to the **wall anchor**. Its `extension` moves the screen forward from that point; `swivel` turns the screen relative to the mount direction. Murphy-bed deployment keeps the cabinet's rear edge fixed.

## Minimal project

This is a complete, empty 12 × 10 foot room with one door and a window:

```json
{
  "format": "home-planner",
  "version": 1,
  "id": "my-room",
  "name": "My room",
  "units": "feet",
  "ceilingHeight": 9,
  "footprint": [
    [0, 0],
    [12, 0],
    [12, 10],
    [0, 10]
  ],
  "walls": [
    {
      "a": [0.2, 0.2],
      "b": [11.8, 0.2],
      "thickness": 0.4,
      "openings": [
        { "at": 6, "width": 4, "height": 4, "sill": 3, "kind": "window" }
      ]
    },
    { "a": [11.8, 0.2], "b": [11.8, 9.8], "thickness": 0.4, "openings": [] },
    {
      "a": [11.8, 9.8],
      "b": [0.2, 9.8],
      "thickness": 0.4,
      "openings": [
        { "at": 3, "width": 3, "height": 7, "sill": 0, "kind": "door" }
      ]
    },
    { "a": [0.2, 9.8], "b": [0.2, 0.2], "thickness": 0.4, "openings": [] }
  ],
  "rooms": [
    {
      "id": "room",
      "name": "Room",
      "x": 6,
      "z": 5,
      "eye": [6, 5.4, 8],
      "target": [6, 3, 2]
    }
  ],
  "fixtures": [],
  "items": [],
  "notes": ["Measure the actual room before ordering furniture."]
}
```

## Architecture

- `id`: 1–80 letters, digits, underscores, or hyphens. Use a stable, distinct id for each home. `name` is display text, up to 120 characters.
- `footprint`: 3–64 `[x, z]` vertices around a simple polygon, in either winding order. Do not repeat the first point at the end. Coordinates are within ±150 feet. Concave footprints are supported; holes, self-intersections, and touching edges are not. Walls are **not** inferred from the polygon.
- `ceilingHeight`: 7–20 feet. Ceilings follow the floor polygon.
- `walls`: up to 200 segments. `a` and `b` are centerline endpoints. Thickness is 0.05–2 feet. Place the centerline half a wall thickness inside an exterior floor edge. An optional `name` labels the segment.
- `openings`: up to 16 per wall. `at` is distance along the wall from `a` to the opening's **center**. Width, height, and sill are in feet. Openings cannot overlap or exceed the wall. `kind` is `window`, `door`, or `passage`. Doors add a rectangular four-foot approach zone; passages do not. These are not exact swing arcs.
- `rooms`: 1–30 named viewpoints with unique ids, center `x`/`z`, camera `eye: [x,y,z]`, and `target: [x,y,z]`. Room centers are where library pieces are added. Room entries do not create partitions.
- `fixtures`: up to 100 fixed oriented boxes. Each needs `name`, `x`, `z`, `w`, `d`, `low`, `high`, `rot`, and `color`. **All fixture dimensions are feet**, including elevation. `low` and `high` are bottom and top elevations. These boxes participate in collision checks.
- `notes`: optional list of up to 30 plain-text assumptions, each no more than 500 characters.

## Furniture

Copy a preset from [`src/catalog.js`](../src/catalog.js), or add it in the UI and download the project. Each item needs a unique `id`, `name`, `type`, `x`, `z`, `rot`, `w`, `d`, `h`, and six-digit hex `color`.

```json
{
  "id": "main-desk",
  "type": "desk",
  "name": "Main desk",
  "x": 6,
  "z": 2,
  "rot": 0,
  "w": 72,
  "d": 30,
  "h": 29,
  "color": "#aa8057"
}
```

At most 250 items are supported. Width and depth are 1–360 inches, height is 0.5–144 inches, and X/Z positions must remain within ±200 feet. These generous input bounds do not certify that every preset mesh retains realistic proportions at every extreme size.

| Type                                                                                                   | Additional fields                                                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `sofa`, `chair`, `coffee`, `rug`, `dining`, `stool`, `console`, `nightstand`, `plant`, `box`, `embody` | None. `embody` is the internal identifier for the illustrative ergonomic rolling chair.                       |
| `bed`                                                                                                  | Optional paired `mattressW` and `mattressD`, within the frame's dimensions.                                   |
| `sectional`                                                                                            | `seatDepth`, smaller than both width and overall depth; `returnSide`: `left` or `right`.                      |
| `recliner`                                                                                             | `open` boolean, `openDepth` at least the closed depth, and `rearClearance` no larger than the depth increase. |
| `tv`                                                                                                   | `mountHeight` at screen center; `extension`: 3–36 inches; `swivel`: −75° to 75°.                              |
| `murphy`                                                                                               | `open` boolean and `openDepth`. Optional desk-bed fields below.                                               |
| `desk`                                                                                                 | Optional monitor fields below. Otherwise a single illustrative desktop screen is rendered.                    |

For a Murphy worktop, provide all of `workDepth`, `deskW`, `deskD`, `deskH`, and `officeMode`. The total closed working depth must be at least cabinet depth plus desk depth and no greater than open projection. `officeMode` is `work`, `maker`, or `guest`; `open` must be true exactly when it is `guest`. In this release the UI toggles work/guest geometry; chair movement and a separate maker-mode workflow are manual.

The optional headboard concept uses `headboardConcept: true`, `headEnd: "positive"` or `"negative"`, and `headboardRaised: boolean`. It cannot be raised while the bed is closed. This is a geometric illustration, not a manufacturer-supported mechanism.

For desk monitors, provide `tvMonitorIn` (27 or 32), `monitorLayout` (`triple`, `quad`, or `wall`), and `tvMonitorMode` (`work` or `guest`). `triple` has one 34-inch ultrawide plus two screens; `quad` has two ultrawides plus two screens. `wall` renders one ultrawide and one 27-inch monitor; **add a separate TV item** for a wall TV. Monitor arms are illustrative, with no load or range certification.

## Saved snapshots

A downloaded snapshot wraps the entire project:

```json
{
  "format": "home-planner-snapshot",
  "version": 1,
  "savedAt": "2026-09-09T12:00:00.000Z",
  "project": {},
  "view": {
    "mode": "plan",
    "activeRoom": "room",
    "position": [6, 200, 5],
    "target": [6, 0, 5],
    "zoom": 1,
    "walkAngle": 0,
    "walkPitch": 0
  }
}
```

Replace the empty `project` above with a complete project. The importer accepts either a project or a snapshot. Invalid views are ignored; invalid projects leave the current workspace intact. Files are limited to 2 MB. Opening a file changes the draft; it does not silently replace a saved checkpoint. A new explicit save is required.

Version 1 is the only supported format. Format changes must preserve compatibility or introduce a documented migration; never reinterpret existing values silently.
