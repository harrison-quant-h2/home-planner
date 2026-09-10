# Security and privacy

Only the latest version on `main` currently receives fixes. This is an early project without a security response SLA.

Report exploitable issues privately through [GitHub's vulnerability reporting form](https://github.com/harrison-quant-h2/home-planner/security/advisories/new). Do not include real addresses, floor plans, browser storage, or credentials in a public issue. Ordinary rendering or geometry bugs can use the public bug template with fictional data.

## Data boundaries

The production app is static. It has no backend, authentication, analytics, external model downloads, or upload endpoint. Imported JSON is parsed, validated, and held locally. Project names are rendered as text. Browser storage is scoped to the origin; it is not encrypted. A script or browser extension with access to that origin may read it. A deployed site's host receives ordinary web requests and may keep access logs.

Project downloads contain their complete architecture, furniture, notes, and camera view. PNG and GLB files can reveal the home. Share only what you intend to disclose. Clearing browser data removes drafts and checkpoints; downloaded files are the portable backup.

The Vite development server serves source files and is intended for loopback development. Publish only the production `dist/` directory. Never put private plans or secrets in `public/`, because its contents are copied into the production build.

Geometry validation bounds scene complexity but does not make arbitrary input inexpensive on every GPU. Keep hostile-input regression cases small and avoid submitting denial-of-service payloads to other people's live instances.
