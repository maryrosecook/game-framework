# Behavior trigger/action model

## Overview

- Make blueprint behavior composable: bind ordered actions to specific triggers.

## Existing behavior

- Keep existing input/update etc keys on blueprint that can have fns assigned to them.

## Triggers

- `create`
- `input`
- `update`
- `collision`

## Actions

- **Location**: `app/engine/actions/` (global only; no per-game actions yet).
- **Shape**: each file exports a default const `{ code: TriggerHandler; allowedTriggers: TriggerName[] }`.
- **Naming**: filename (without `.ts`) is the action name referenced by blueprints.
- **Compatibility**: UI and engine only allow binding an action to triggers listed in `allowedTriggers`.

## Initial actions

- `moveWithArrows` - move the thing with the arrow keys, only allowed on input.
- `destroySelf` - destroy the thing, allowed on any trigger.

## Wiring behaviors on blueprints

- `game.json` (per game) adds a `behaviors` object on each blueprint.
- Keys are trigger names; values are ordered arrays of action names.
- Execution order per trigger:
  1. Blueprint handler in the module (if present) runs first.
  2. Then run the `behaviors[trigger]` action list in order.
- Each action call is wrapped in `try/catch` to keep the game running even if an action throws.

## UI (from action-definition.png)

- Blueprint panel gets an “Actions” tab.
- Shows trigger sections (create, input, update, collision).
- “Add Action” opens a select of available global actions (no custom creation).
- When selecting, enforce trigger compatibility based on `allowedTriggers`.
- Actions listed per trigger can be reordered/removed.

## Hot reload

- Single pipeline for blueprints + actions:
  - One watcher (`scripts/watch-blueprints.ts` or successor) watches `app/games/*/blueprints/*.ts` and `app/games/*/actions/*.ts`, regenerates a single per-game manifest plus shared index with one content hash `manifestVersion`, and dispatches `manifest-updated` when (re)loaded.
  - The manifest lists both blueprints and actions; built-in actions can be in a separate section if they’re static, but the version covers all watched game-local modules.
  - `useGame` (one hook) reads `manifestVersion`, calls a unified `engine.hotReload(...)`, and re-calls on `manifest-updated`.
  - `engine.hotReload` compares versions, re-imports blueprint modules and action modules via the manifest (dynamic import fallback if needed), refreshes blueprint/action registries, images, runtime state, and notifies subscribers so behaviors pick up edits immediately.

## Implementation Plan

### Stage 1: Baseline actions + behaviors wiring (no UI, no hot reload)
- Implement global `moveWithArrows` action.
- Add `behaviors` mapping on blueprints to call actions in order.

### Stage 2: Destroy + UI
- Implement global `destroySelf` action.
- Build the “Actions” tab UI to add/reorder/remove actions per trigger.

### Stage 3: Hot reload
- Implement the unified watcher/manifest pipeline so blueprint/action edits hot-reload into the running game.
