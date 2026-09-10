# Static deployment and privacy

Build with `pnpm build`, then serve the contents of `dist/` with your static host. The Vite configuration uses relative asset paths so a project can live under a subdirectory. There is no server-side routing, API endpoint, login, or database. Use HTTPS away from localhost for browser APIs such as UUID generation.

Only `dist/` is the deployment artifact. Do not publish the checkout, local development server, `.git`, `.env`, `private/`, or personal exports. Vite copies everything in `public/` into `dist/`; review that folder before every release. The default distribution contains only the fictional demo, favicon, and license notice.

The app loads its own scripts, styles, and example JSON. It generates all furniture and materials locally. It does not send imported projects to a service. The production app has no analytics. Host request logs and browser extensions are outside the app's control. See [SECURITY.md](../SECURITY.md).

Browser storage belongs to an origin. Changing the domain, protocol, or port creates a separate workspace. A static host should serve only trusted scripts on that origin. Download JSON before changing hosts or clearing site data.

Development uses `127.0.0.1:5173`; production preview uses `127.0.0.1:4173`. Neither command exposes a network interface by default. No hosting deployment is provisioned by this repository's CI.
