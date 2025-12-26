# Blueprint behavior builder spec

## Overview

- Trigger/action model for blueprint behavior.
- Triggers e.g. onGameStart, onThingUpdate, onThingCollision.
- Actions e.g. moveThing, rotateThing, custom.
- User can implement custom actions (not triggers) in the UI via an LLM conversation and codegen.

## Goals

- Retain existing blueprint input/update/collision approach of letting the handler mutate the current thing directly, and letting it call game.spawn or game.destroy.
- Safety around running broken custom actions. Should be a try/catch around all blueprint handler functions to catch exceptions and let the game keep running.
- The latest version of the behavior being edited should be run whenever its trigger fires. (And exception caught if it throws.)
- Make actions reusable: built-ins from the engine, custom per-game actions on disk, and references by name from blueprints.

## Triggers

- create, input, update, collision

## Actions

- Two types
  - Built-in: moveThing
  - Custom: Custom-written function that can be edited in the UI.
- Actions on disk:
  - each action is a `.ts` file exporting a default const pointing at an object with this structure { summary: string, code: handler function signature, allowedTriggers: TriggerName[] }.
  - Filename is the canonical action name.
  - Custom actions live under `[game-name]/actions/`
  - Built-in actions live under `engine/actions/`.
- Action compatibility:
  - Each action declares `allowedTriggers: TriggerName[]`.
  - Default on creation: only the trigger it was added to is in `allowedTriggers`; author can later widen the list.
- Blueprint binding trigger -> actions
  - Existing handler slots (`create`, `input`, `update`, `collision`, `render`, etc.) accept as before.
  - In `game.json`, each blueprint has a `behaviors` object whose keys are trigger names and whose values are arrays of ordered action names.
  - Engine should enforce compatibility: when wiring `behaviors`, only attach actions whose `allowedTriggers` include that trigger.
- Action execution
  - Action execution is executed in the same fashion ase they are currently in the existing blueprint file handler code.
  - Add a try/catch around each action function call to catch exceptions and let the game keep running. If running an array of actions, each action should be in its own try/catch.
  - Execution order per trigger: normalize the legacy handler slot (if present) to an array and run those first, then run the `behaviors` action list in order. All handlers use the same running approach as the blueprint file handlers.
- Naming
  - Actions are named like `game-name/actions/[actionName].ts`.
  - If an action is renamed, all references to it in the `game.json` file should be updated to the new name.

## Hot reload

- Single pipeline for blueprints + actions:
  - One watcher (`scripts/watch-blueprints.ts` or successor) watches `app/games/*/blueprints/*.ts` and `app/games/*/actions/*.ts`, regenerates a single per-game manifest plus shared index with one content hash `manifestVersion`, and dispatches `manifest-updated` when (re)loaded.
  - The manifest lists both blueprints and actions; built-in actions can be in a separate section if they’re static, but the version covers all watched game-local modules.
  - `useGame` (one hook) reads `manifestVersion`, calls a unified `engine.hotReload(...)`, and re-calls on `manifest-updated`.
  - `engine.hotReload` compares versions, re-imports blueprint modules and action modules via the manifest (dynamic import fallback if needed), refreshes blueprint/action registries, images, runtime state, and notifies subscribers so behaviors pick up edits immediately.

## Action definition UI

- See `docs/action-definition.png`.
- Existing panel gains an “Actions” tab.
- Update actions are listed first (e.g., `inputMoveTrigger`).
- “Add Action” opens a select menu to choose existing or create custom; custom opens a modal to type code and save.
- Collision section lists actions to run on collision (e.g., `destroySelf`).

## Chat-driven action editing

- Conversation-driven edits. Each turn includes action name, code for blueprint file based actions and behaviors actions for the blueprint, prior code written during the chat.
- Only edits the current action.
- Agent returns updated code (for entire action) + natural-language summary. System runs `tsc`/lint; on failure, revert to last good and show error.
- Encourage concise code.
- Use Sonnet 4.5 for code generation.

## Implementation Phases

### Phase 1 - Actions on disk

- Implement example global action `moveThing`.
- Implement ability to call an action from another action - `game.action("actionName")`.
- Create inputArrowMove action in `mysteries` game to move the guy with the arrow keys. It should wire up the arrow keys to use the moveThing action to move the guy.
- Implement `behaviors` in `game.json` to wire up triggers to actions.
- Wire up `input` trigger on `guy` `behaviors` object to point at the inputArrowMove action.
- Update the `update` trigger signature to pass in keyState to the action being called both for `update` function on blueprints and also for the `behaviors` actions.

### Phase 2 - Write action by hand and add to blueprint trigger in the UI

## Later - not in scope for this project

- View/edit custom action code in the UI.
- message() blueprint handler and game.sendMessage() api that blueprint handler can call.

### Observability

- For each action, show
  - Natural language summary
  - API methods called by the action.
  - Calls to spawn/destroy.

### Config + Tuning

- Actions declare params with UI hints (slider, dropdown, toggle). Stored alongside code. Agent can add/update params and wire them into logic.
- Ship presets for common verbs (move with input, face target, chase, wander, explode on death) as composable actions.
