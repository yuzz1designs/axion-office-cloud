# AXION Desktop — milestone 1 (local development)

`npm run desktop:dev` builds the shared UI and opens it in Electron. `npm run desktop:package` creates a local macOS application under `desktop-release`.

This is a development milestone, **not a distributable production release**. No `.env` or OAuth cache is packaged. When no server is running on localhost:3000, the app starts its backend and Companion (4320) as supervised utility processes. In packaged mode select your external local `.env` on startup; runtime data is written to Electron userData. Do not distribute administrative server credentials to other users.

When an existing AXION server is already running on port 3000, the shell reuses it and does not stop or replace that server or Companion. The app menu exposes the pairing code only for its own Companion. Pairing remains manual in this milestone. Processes started by the app are terminated when it closes.

The renderer has no Node integration, no privileged preload bridge, sandboxing and context isolation enabled. External HTTPS navigation requires user confirmation and opens in the system browser. Other external schemes are blocked. Only microphone requests from the AXION origin are eligible for permission.

Google sign-in opens in the system browser and returns the authenticated session to the isolated Electron partition through a short-lived, single-use local handoff. The browser callback never opens the dashboard itself.

Known gates before production: remote backend/secrets separation; stable Developer ID signing/notarization; permission validation from the installed application; App Registry/central policy; MCP; signed updates. Current packaging intentionally uses no distribution identity. Local localhost origin uses the existing application's network architecture; this is not the final privileged desktop IPC transport.

Regression: npm test, npm run typecheck, npm run lint, npm run build. Do not claim OAuth, live voice or computer control validated solely from unit tests or packaging.
