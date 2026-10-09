# Validation — 9 October 2026

Verified in the current cloud instance with Node.js 24.19.0 and npm 11.9.0.

- Frozen-lockfile reinstall (`npm ci`): passed.
- TypeScript (`npm run typecheck`): passed.
- ESLint (`npm run lint`): passed.
- Vitest (`npm test`): 29 tests passed. Coverage includes SQLite persistence, assigned chat tasks, dependency guards, explicit live-provider failures, locks, approval requirements, revision propagation, schedule idempotency, generated-image packaging, webhook receipt validation, and manager session/origin checks. Additional coverage verifies encrypted backend storage, endpoint-scoped keys, model switching, connection probes, recovery after a lost encryption key, custom agent persistence, role/skill prompts, approval invalidation, and configuration locks during long campaigns, keyless local inference requests, loopback-only HTTP validation, and local reasoning probes. Provider requests in these tests are mocked.
- Playwright (`npm run test:e2e`): 6 tests passed. A human manager creates a campaign, runs all eight demo agents, requests a revision, reruns it, approves all outputs, exports the package, and reloads persisted work. Separate checks cover chat assignment persistence, narrow-screen navigation, saved backend endpoint/model changes, and creating/editing a custom agent. The custom agent produces demo work containing its skills, appears as a clickable character in the Claw3D office, displays skills in its profile, receives a manager chat task, and survives reload. The complete 3D scenario allows 120 seconds for software-rendered Chromium; all assertions ran. An additional test starts a real HTTP stub on loopback, saves the Ollama preset with the requested model name, tests the chat connection, runs a live-mode task through that stub, and verifies no Authorization header or cloud key is sent. This validates local transport, not the actual installed laptop model.
- Production build (`npm run build`): passed.
- Production startup (`npm start`): passed. HTTP office response contains 9 agents, 4 AI divisions, and 8 seed tasks. Browser rendered the actual Claw3D rooms and agent labels, opened an agent profile, and displayed the team screen. No browser page errors or failed browser asset requests occurred. Mobile document had no horizontal overflow.
- Local development launcher (`npm run dev:local -- --port 3002` with isolated data): passed. HTTP 200 reports the requested Gwen3.8:27b model, loopback API, and no text API key. Ollama and that model are on the user's laptop and are not accessible from this cloud instance.
- Local production launcher (`npm run start:local -- --port 3002` with isolated data): passed. Browser confirms the Ollama preset and requested model in the built application. Local and cloud backend screens opened in two Chromium tabs without page errors; actual laptop inference remains unverified.
- Portrait atlas: generated with GPT Image and visually inspected before integration.

Screenshots: [Office](screenshots/office.png), [Team](screenshots/team.png), [Mobile](screenshots/mobile.png).

The production backend settings and team navigation were verified in two Chromium tabs without page errors. New screenshots: [Backend API](screenshots/backend-api.png), [Agents and skills](screenshots/backend-agents.png).

An actual OpenAI connection probe was attempted using the existing environment binding. Node fetch initially could not resolve the provider directly. Enabling the supported `NODE_USE_ENV_PROXY=1` startup option restored connectivity through the cloud proxy, preserving the provided CA configuration; an anonymous models request returned HTTP 401. The authenticated connection probe also returned HTTP 401. The binding is present, but successful provider authentication is not verified: a usable provider credential is needed through Backend & API or secure environment settings. No live campaign text or in-app campaign-image generation succeeded against real providers. Unit provider tests use mocks.

The bundled character portrait atlas was produced independently with the GPT Image generation tool. No Instagram/TikTok account was connected and no external content was published. Local schedules and JSON export work; the optional webhook requires the user's configured recipient and credentials.

The environment draft retains the tested install script, MARKETING_AI_MODEL suggestion, and MARKETING_AI_KEY secret requirement with api.openai.com as its allowed destination. Updated start instructions and a NODE_USE_ENV_PROXY=1 suggestion were saved for cloud development, production startup, and laptop Ollama usage. Saving that draft does not publish the environment or inject a secret value. Fresh-task restoration has not been independently tested.
