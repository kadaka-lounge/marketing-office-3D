# Claw3D integration

Source: [iamlukethedev/Claw3D](https://github.com/iamlukethedev/Claw3D)

Pinned upstream commit: `0565b7892909eca7bbc8f2d9b0fad171dd75ad7c`.

This application uses the actual Claw3D animated voxel `AgentModel`, avatar
profile generator, coordinate helpers and furniture models. It does not embed
the upstream application or require its OpenClaw Gateway.

Selectively vendored upstream files:

- `src/features/retro-office/objects/agents.tsx`
- `src/features/retro-office/objects/types.ts`
- `src/features/retro-office/core/{constants,geometry,types}.ts`
- `src/lib/avatars/profile.ts`
- `src/lib/office/places.ts`
- `public/office-assets/models/furniture/*.glb`

Local adaptations: the agent component uses bundled Open Sans instead of remote
font loading, and `AGENT_SCALE` is 2.1 to fit the furniture proportions. The
independent `OfficeScene` adapts persisted agent statuses to
Claw3D characters and arranges the models into four marketing divisions around
a human manager. It deliberately does not simulate agent work or fabricate live
activity; idle animation is decorative.

The upstream MIT license is reproduced in [LICENSE](LICENSE). Open Sans is
distributed under Apache 2.0; its separate license and notice are beside the
font in `public/office-assets/fonts/`.
