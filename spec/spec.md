# Game Spec

## Core tech

- TypeScript.
- React.
- Next.js
- api routes for file read/write.
- Games are edited and played on desktop.
- 2D games with Canvas 2D rendering.

## Directory structure

- data/editorSettings.json
- app/games/[game-name]/
  - game.json
  - blueprints/
    - [blueprint-name].ts
- app/engine/
  - engine.ts
  - useGame.ts
  - physics.ts
  - render.ts
  - input.ts
- app/components/
  - App.tsx - just a shell
  - Game.tsx
  - GameCanvas.tsx

## Game engine

- Pure TS game engine (no React).
  - Use requestAnimationFrame to run game loop (runs at max frame rate, no delta time handling for now).
  - Big ball of state with reducer function.
- On start
  - Load blueprints from game.json.
  - For each blueprint in game.json, dynamically import the corresponding TypeScript file from app/games/[game-name]/blueprints/[blueprint-name].ts
  - Load `things` from game.json into thing array.
  - Set each thing's **proto** to point at the relevant blueprint instance.
  - Camera position loaded from game.json
- On tick (always runs regardless of gameState.isPaused)
  - Physics step runs first (collision detection and separation).
  - Game engine loops over things and calls their input function. [does not run if paused]
  - Game engine loops over things and calls their blueprint's update function (if exists). [does not run if paused]
  - Game engine loops over things and calls their render function (if exists). [always runs]
  - When a dispatch function mutates a thing, the game engine uses the same
    reducer that backs the useGame hook to update the relevant part of
    gameState so React panel subscribers will get re-rendered.
  - After update, diff the game state with the state prior to the update and
    issue dispatch mutations to update gameStates with the changed data
- Rendering is done in world coordinates, translated by camera position.

## GameState (in-memory)

The engine maintains two copies of game state:

1. **gameState**: Updated by dispatch actions (regardless of whether playing/paused). This is the live state used for rendering and game logic.
2. **persistedGameState**: Updated by dispatch actions, but only when game is paused. This is what gets saved to game.json (debounced, every 100ms).

```typescript
{
  things: Thing[],
  blueprints: Blueprint[],
  camera: { x: number, y: number },
  screen: { width: number, height: number },
  isPaused: boolean,
  selectedThingId: string | null
}
```

## Game API

- Games live in an app/games/[game-name]/ directory.
- Each game has a game.json file that contains the initial game state
- Blueprint functions (all work through mutation and return nothing):
  - update(thing: Thing, gameState: GameState): void
  - render(thing: Thing, gameState: GameState, ctx: CanvasRenderingContext2D): void
  - input(thing: Thing, gameState: GameState, keyState: KeyState): void
  - collision(thing: Thing, otherThing: Thing): void (called when a collision occurs)
- KeyState interface:
  - arrowLeft: boolean
  - arrowRight: boolean
  - arrowUp: boolean
  - arrowDown: boolean
  - space: boolean
  - shift: boolean
- Input handling:
  - Game engine includes input handler listening for keydown/keyup events.
  - Tracks state of arrow keys, space, and shift keys only.

## React-based game editor

- React panels implement data panels and editing controls.
- Game engine should be initialized and started from the editor in a succinct
  hook call, but none of the engine should actually be implemented in React.
- Read/write game state
  - React component can subscribe to parts of the game state and put that
    state in a state var. This subscription should only cause a re-render if
    the subscribed state actually changes. If we can do this in referential
    transparency, that's great, but if it has to be deep compare that's fine.
  - React components should also be able to dispatch mutations on the game state.

## First game

- Called commando
- For now, just a Player blueprint and thing instance that can move with arrow keys.

## useGame hook

- Takes canvas ref.
- Returns
  - isPaused state var
  - subscribe function that
    - Takes a path of one of these forms:
      - ["things", thingId]
      - ["things", thingId, property] (e.g. ["things", id, "x"] or ["things", id, "velocity"])
      - ["things"] (all things)
      - ["blueprints", blueprintName]
      - ["camera"]
      - ["screen"]
      - ["isPaused"]
      - ["selectedThingId"]
    - Returns [state, dispatch] where state is the subscribed state and dispatch
      allows setting a new value of that piece of state.
    - Subscribes the caller to state changes in that piece of state. If that
      piece of state changes, the subscribing React component will re-render.
- Starts the game loop.
- dispatch signature: `dispatch(action: Action)` where Action is:
  ```typescript
  type Action =
    // Thing mutations
    | { type: "setThingProperty"; thingId: string; property: keyof Thing; value: any }
    | { type: "setThingProperties"; thingId: string; properties: Partial<Thing> }
    | { type: "addThing"; thing: Thing }
    | { type: "removeThing"; thingId: string }

    // Blueprint mutations
    | { type: "setBlueprintProperty"; blueprintName: string; property: keyof Blueprint; value: any }
    | { type: "setBlueprintProperties"; blueprintName: string; properties: Partial<Blueprint> }
    | { type: "addBlueprint"; blueprint: Blueprint }
    | { type: "removeBlueprint"; blueprintName: string }

    // Camera/screen
    | { type: "setCameraPosition"; x: number; y: number }
    | { type: "setScreenSize"; width: number; height: number }

    // Editor state
    | { type: "setPaused"; isPaused: boolean }
    | { type: "setSelectedThingId"; thingId: string | null };
  ```

## Boot process

- In top level component,
  - Create canvas with ref
  - Start the engine with a useGame hook, passing canvas ref.

## data/editorSettings.json

- Located at repo-root/data/editorSettings.json

```json
{
  "currentGameDirectory": "[game-name-directory]"
}
```

## Thing and Blueprint

- Thing is an instance of a Blueprint.
- Multiple things can share the same blueprint.
- Each thing's **proto** points at the relevant blueprint instance.
- Blueprint
  - Functions - update, render, input, collision (all are optional).
    - defined in [blueprint-name].ts
  - Data - name: string, width: number, height: number, z: number, color: string
- Thing
  - Data - id: string (12 alphanumeric character GUID), x: number, y: number, z:
    number, width: number, height: number, angle: number (rotation in degrees),
    velocity: { x: number, y: number }, physicsType: "static" | "dynamic",
    color: string, blueprintName: string

## game.json

- Blueprint data (not functions) is stored in blueprints[].

```json
{
  "things": [],
  "blueprints": [],
  "camera": {
    "x": 0,
    "y": 0
  },
  "screen": {
    "width": 800,
    "height": 600
  }
}
```

## Physics

- physics.ts
  - All things participate in collision resolution.
  - static: don't move, dynamic: can move
- Collision detection: Axis-Aligned Bounding Boxes (AABB).
  - Every object is assumed to be a rectangle (can be rotated).
- Collision separation: Separating Axis Theorem (SAT) to pull objects apart.
- When a collision occurs, the collision function is called on both objects involved:
  - collision(thing, otherThing) is called on both things where thing is the
    object whose collision function is being called and otherThing is what it collided with.

## Rendering

- render.ts
- Canvas 2D for all rendering.
- Screen coordinates in pixels.
- Game operates in world coordinates.
- Rendering translates world coordinates by camera position.
- Things are rendered in order of their z value (lower z renders first, higher z renders on top).
- For now, no assets or sprites - everything is drawn as a colored rectangle.

## Coordinates

- React land needs to translate clicks to world coordinates.
- World coordinates match screen coordinates (1:1 ratio).

## Editor UI

- See mock in spec/editor-layout.png
- Full width and height of window is filled with the canvas element.
- A light-colored rectangle is shown that indicates the game screen boundaries
  within the canvas (likely much smaller and probably a different aspect ratio).
- Toolbar at the bottom:
  - Lists all blueprints.
  - Has a + button to add a new blueprint.
  - Clicking a blueprint opens a side panel that lets you edit its properties
    (name, width, height, z, color selector).
  - Dragging a blueprint from the toolbar onto the canvas adds a thing of that
    blueprint to the game at the drop position.
- Play/pause button to the left of the blueprint toolbar.
- Things can be dragged around on the canvas to reposition them.
- Available colors `"#b399ff"`, `"#99b3ff"`, `"#99d6ff"`, `"#ffcc99"`, `"#ff9966"`,
  `"#99e6cc"`, `"#66cc99"`, `"#ffb3cc"`, `"#ff6699"`, `"#f5f5f5"`,
  `"#d9d9d9"`, `"#b3b3b3"`, `"#4d4d4d"`

## Out of Scope (for now)

- Delta time handling (runs at max requestAnimationFrame rate).
- Sound/audio.
- Image assets or sprites (everything is colored rectangles).
- Error handling.
- Mouse input to the game itself (editor mouse input is implemented).

## Component hierarchy

- App.tsx
  - Game.tsx
    - useGame() hook
    - GameCanvas.tsx
    - Toolbar.tsx
