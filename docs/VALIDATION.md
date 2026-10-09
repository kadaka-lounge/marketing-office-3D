# Validation — 9 October 2026

Verified in the current cloud instance with Node.js 24.19.0 and npm 11.9.0.

- Frozen-lockfile reinstall (`npm ci`): passed.
- TypeScript (`npm run typecheck`): passed.
- ESLint (`npm run lint`): passed.
- Vitest (`npm test`): 15 tests passed. Coverage includes SQLite persistence, assigned chat tasks, dependency guards, explicit live-provider failures, locks, approval requirements, revision propagation, schedule idempotency, generated-image packaging, webhook receipt validation, and manager session/origin checks. Provider requests in these tests are mocked.
- Playwright (`npm run test:e2e`): 3 tests passed. A human manager creates a campaign, runs all eight demo agents, requests a revision, reruns it, approves all outputs, exports the package, and reloads persisted work. Separate checks cover chat assignment persistence and narrow-screen navigation.
- Production build (`npm run build`): passed.
- Production startup (`npm start`): passed. HTTP office response contains 9 agents, 4 AI divisions, and 8 seed tasks. Browser rendered the actual Claw3D rooms and agent labels, opened an agent profile, and displayed the team screen. No page errors or failed requests occurred. Mobile document had no horizontal overflow.
- Portrait atlas: generated with GPT Image and visually inspected before integration.

Screenshots: [Office](screenshots/office.png), [Team](screenshots/team.png), [Mobile](screenshots/mobile.png).

Live text-generation and in-app campaign-image requests were not executed against OpenAI because no application API key is configured. The bundled character portrait atlas was produced independently with the GPT Image generation tool. No Instagram/TikTok account was connected and no external content was published. Local schedules and JSON export work; the optional webhook requires the user's configured recipient and credentials.

The environment draft saves the tested install script, start instructions, MARKETING_AI_MODEL suggestion, and MARKETING_AI_KEY secret requirement with api.openai.com as its allowed destination. Saving that draft does not publish the environment or inject a secret value. Fresh-task restoration has not been independently tested.
