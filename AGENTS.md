## Overview

- This project implements a game framework, and contains a collection of games built with the framework.
  - See `docs/game-framework.md` for information about how to edit the game framework.
  - See `docs/game-making.md` for information about how to implement a game.

## Coding guidelines

- Enforce strict, explicit types across engine and UI. Do not rely on `any`,
  `as` casts, or other unsafe coercions.
- Ensure all changes have no lints or TypeScript errors.
- Check TS errors with `npx tsc`
- Never migrate any game data in code or handle legacy data. Assume all data uses latest schema. If a schema is changed as part of a code / spec change, migrate the existing game data as part of the change.
- Always use function name() {} syntax for named functions.
