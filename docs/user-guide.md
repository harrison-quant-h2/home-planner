# Using Home Planner

## Bring listing photos into your model

Open **References** to import Zillow listing JSON prepared by an agent, or use **Look up with MCP** with a configured local server. Review the source and image counts, then attach references to the current project. A supplied model layout has a separate action and includes its measurement basis. See the [connection guide](zillow-mcp.md).

Choose **Load listing images**, select a photo, assign its room or window, and inspect it in **Walk through**. Switch the visible side if the image faces away from the room. Window photos are illustrative backdrops, not measured outdoor geometry. Room and window assignments support Undo, checkpoint Reset, and JSON backups. On reload, images stay hidden until you choose to load them again. GLB exports exclude listing photos.

## Arrange

Click a piece in the scene or choose it from **Select a piece**. Dimensions use inches; X and Z positions use feet. Numeric changes apply when you leave the field. Dragging snaps to one inch unless **Snap 1″** is unchecked. A piece may be moved through or outside walls so you can experiment; warnings describe the current placement.

The library adds new pieces near the last explored room's center. **Empty home** removes movable furniture. **Starter layout** restores the loaded starting arrangement. Both can be undone. **Undo** and **Redo** retain up to 40 changes during the current session; they are not saved across reloads.

Use a piece's specific controls to flip a sectional's return, deploy a bed or recliner, swivel a TV, or switch a desk's monitors. A dashed outline shows the deployed footprint before opening. Opening a bed does not automatically park chairs or validate the motion between endpoints. Move obstructing furniture yourself and recheck the real mechanism.

## Save, experiment, restore

| Action                | Result                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Drag or edit          | Updates the browser draft; saved checkpoint remains intact.                             |
| Save checkpoint       | Captures the current project and camera in browser storage.                             |
| Reset to saved        | Restores checkpoint furniture and view. Undo can recover the pre-reset furniture.       |
| Download project JSON | Downloads the complete current project and view; does not replace the checkpoint.       |
| Open project          | Loads validated data into the draft; leaves its architecture-specific checkpoint alone. |
| Reload                | Restores the browser draft when available; undo history starts fresh.                   |

Checkpoints are scoped to a project and its architecture. Changing its id, walls, floor boundary, rooms, fixtures, name, or notes creates a different checkpoint namespace, preventing a restore from an incompatible home. Multiple tabs share checkpoint notifications, while their working drafts may diverge; the last draft write wins on reload. Prefer one editing tab per project.

Browser storage can be blocked, cleared, or exceed its quota. The status reports write failures, and a failed checkpoint write retains the previous checkpoint. Download JSON for a backup independent of the browser. Private browsing and different browser profiles or origins have separate storage.

## Views and shortcuts

- **3D home:** drag empty space to orbit, scroll to zoom.
- **Floor plan:** drag empty space to pan; furniture remains draggable.
- **Walk through:** drag to look, W A S D or arrow keys to move, Escape to return. Walking checks walls and fixed fixtures, not movable furniture.
- **R:** rotate the selected piece 90°. **Delete/Backspace:** remove it.
- **Ctrl/⌘ Z:** undo. **Ctrl/⌘ Shift Z:** redo.

Shortcuts run when the scene or page is focused, not while typing or operating a button. Numeric inputs and the furniture dropdown provide keyboard editing. The 3D model is not fully accessible nonvisually. Desktop use is recommended.

## Export

**Save image** downloads the current canvas as PNG, without selection outlines. **Export 3D** downloads a GLB containing the full architecture, ceiling, furniture, and procedural materials in meters. Hide the `Ceiling` node in Blender or another viewer to inspect from above. Room labels, temporary selection guides, and UI are omitted. Exports describe illustrative geometry, not manufacturing-ready CAD.
