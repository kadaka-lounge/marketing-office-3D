# Working in this repository

- Use the existing checkout. Cloud tasks are already isolated; do not create a Git worktree unless the user asks.
- Use Node.js 24 or newer and `npm ci` with the committed lockfile.
- Start development with `npm run dev`; the default listener is `127.0.0.1:3000`.
- Keep provider calls, tokens, SQLite, and filesystem access on the server. Never expose secret values through client code, logs, API responses, or `NEXT_PUBLIC_` variables.
- Preserve the distinction between demo output, live AI output, and manually edited work. Demo metrics and research must not be presented as measured facts.
- The human manager controls artifact approval and external publication. Approval or scheduling alone must not send anything to social networks or webhooks.
- Preserve persisted campaigns and artifacts. Use an isolated `OFFICE_DATA_DIR` for automated tests.
- Validate functional changes with the relevant tests, plus `npm run typecheck`, `npm run lint`, and `npm run build` when appropriate. `npm run test:e2e` starts a separate development server and uses system Chromium by default; see the README for overrides.
- Retain Claw3D's upstream attribution and license when changing vendored code. See `vendor/claw3d/README.md` for the pinned source and local adaptations.
- Keep Indonesian product copy clear and concise. Instagram and TikTok are the initial campaign channels.
