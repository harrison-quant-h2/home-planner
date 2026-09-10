# Static deployment and privacy

Build with `pnpm build`, then serve the contents of `dist/` with your static host. The Vite configuration uses relative asset paths so a project can live under a subdirectory. There is no server-side routing, API endpoint, login, or database. Use HTTPS away from localhost for browser APIs such as UUID generation.

Only `dist/` is the deployment artifact. Do not publish the checkout, local development server, `.git`, `.env`, `private/`, or personal exports. Vite copies everything in `public/` into `dist/`; review that folder before every release. The default distribution contains only the fictional demo, favicon, and license notice.

The app loads its own scripts, styles, and example JSON. It generates built-in furniture and materials locally. It does not send imported projects to a service. The production app has no analytics. Optional listing images contact their source hosts only when the user chooses to load them or opens a source link. Image URLs and attribution remain in private JSON exports; GLB excludes listing backdrops. Host request logs and browser extensions are outside the app's control. See [SECURITY.md](../SECURITY.md).

The optional `pnpm dev:zillow` MCP bridge runs only in the local Vite server. It sends an explicitly entered property address to the configured provider and keeps bearer credentials server-side. It is not included in `dist/` and is not a public hosting service. Static deployments support listing JSON import and image/window mapping; they cannot use the local direct lookup. Never expose the development server or put credentials in `VITE_*` variables. See [Zillow MCP](zillow-mcp.md).

Browser storage belongs to an origin. Changing the domain, protocol, or port creates a separate workspace. A static host should serve only trusted scripts on that origin. Download JSON before changing hosts or clearing site data.

Development uses `127.0.0.1:5173`; production preview uses `127.0.0.1:4173`. Neither command exposes a network interface by default. No hosting deployment is provisioned by this repository's CI.
