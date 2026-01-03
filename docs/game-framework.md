# Game framework

## Overview

- A desktop-first 2D game editor and runner where games are created,
  edited, and played in-browser with a full-screen Canvas. Editing uses React;
  the game engine stays pure TypeScript outside React except for a succinct hook
  to start it.
- Goals: keep the engine independent of the UI, support live play/pause control
  from the editor, and persist edited game data back to disk in a predictable
  format.
- When you are asked to edit a game (e.g. adding game behavior), look in
  editorSettings.json to infer which game you should edit

## Technology Stack

- TypeScript with strict typing; avoid casts and any escape hatches (`as`,
  `unknown` tricks) to preserve type safety end to end.
- React for the editor UI, running inside Next.js with API routes for file
  read/write.
- Canvas 2D rendering for all games; targeting desktop workflows.

## Directory Layout

- `data/editorSettings.json` stores editor preferences such as the current game
  directory.
- `data/games/[game-name]/` holds each game:
  - `game.json` initial state persisted from the editor when paused.
  - `blueprints/` TypeScript blueprint modules (e.g., `player.ts`, `wall.ts`).
  - `images/` PNG images for blueprints.
- `app/engine/` pure TS game engine (loop, reducer, physics, render, input,
  blueprint glue).
- `app/components/` React UI (shell, game view, canvas, toolbar) plus
  `app/page.tsx` entry.
- `app/api/` Next.js API routes that load and save game data and blueprints.
- `app/lib/`, `public/`, `styles/` supporting utilities, assets, and styling.

## Data modelling

- Game objects are things, and inherit from a blueprint.
- Blueprints specify image, shape, color, physics type, weight, bounce, and
  behavior.
- Things override x, y, width, height, angle of their blueprint.

## Game Engine and Runtime Flow

- Pure TypeScript engine driven by `requestAnimationFrame` (max frame rate, no
  delta time yet); UI/editor changes go through the reducer-backed raw state.
- Startup: load `game.json`, dynamically import each referenced blueprint module
  from `data/games/[game-name]/blueprints`, instantiate blueprints, and set
  camera from the saved state.
- Tick order (engine runs even when UI is idle): physics step first; then input
  handlers and blueprint `update` functions only when not paused; blueprint
  `render` always runs; rendering uses world coordinates translated by camera.
- Blueprint handlers mutate runtime things directly; spawns/destroys happen via
  `game.spawn`/`game.destroy` and are applied at the end of the tick.
- Runtime changes are synchronized back into the raw state so persistence and
  subscribers stay in sync.

## Game State and Persistence

- Two state copies: `gameState` (live for rendering/logic, updated by game logic
  AND game editor edits) and `persistedGameState` (updated only by game editor
  edits). When paused, changes debounce-save to
  `data/games/[game-name]/game.json` (~100ms cadence).
- Core shape: `{ things: Thing[]; blueprints: Blueprint[]; camera: {x,y};
screen: {width,height}; isPaused: boolean; selectedThingId: string | null }`.
  - `screen` is runtime-only and always mirrors the current window/canvas size.
  - `game.json` does not persist `screen`.

## React Editor and UI Model

- Full-window layout with Canvas dominating the view. Play/pause control sits
  alongside a bottom blueprint toolbar.
- Blueprint toolbar lists blueprints, supports creation, opens a side panel for
  properties, and allows dragging a blueprint onto the canvas to spawn a thing
  at the drop point.
- Things can be dragged within the canvas to reposition. A defined color palette
  keeps visual consistency.
- React panels subscribe to specific slices of state and re-render only on
  changes. Components dispatch mutations to the reducer; if referential
  transparency is possible we prefer it, otherwise deep-compare subscriptions
  are acceptable.
- Boot: top-level component creates a canvas ref and starts the engine via a
  concise `useGame` hook call.

## Reducer and Hook Strategy

- `useGame` starts the loop and returns `isPaused` plus a `subscribe` API for
  targeted state slices (things, blueprints, camera, screen, pause state,
  selection) along with a single `dispatch(Action)` entry point.
- The reducer handles actions for thing and blueprint mutation, camera changes,
  pause toggling, and selection. Engine and React UI share this reducer so UI
  edits and in-game mutations stay consistent.
