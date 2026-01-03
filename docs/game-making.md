# Game making

## Overview

- This document is a guide for how to make a game using the game framework.
- To understand which game is being edited, look in the
  `data/editorSettings.json`.

## Game structure

- 2D game framework with basic SAT physics.
- Game objects are called things.
- Things inherit from a blueprint.
- Blueprints specify image, shape, color, physics type, weight, bounce, and
  behavior.
- A blueprint's behavior is implemented in
  `data/games/[game-name]/blueprints/[blueprint-name].ts`.
- Every blueprint must have a [blueprint-name].ts file. However, it can be
  empty.
- Things have x, y. They can override x, y, width, height, angle of their
  blueprint.

## Blueprint behavior

- To define custom blueprint behavior, export a default function that will
  create a blueprint.
- You can implement a custom `data` schema, and input/update/collision/render
  functions.
- If not overridden, input/update/collision are no-ops.
- Handler functions return `void`; use `game.spawn`/`game.destroy` to add or
  remove things during a frame.
- If not overridden, render will render an image if set on the blueprint data,
  or a rectangle with the blueprint's color if not.

```ts
const DataSchema = z.object({
  // ...
});

type BlueprintData = z.infer<typeof DataSchema>;

const BlueprintDefinition = defineBlueprint({
  name: "blueprint-name",
  dataSchema: DataSchema,
  create: (blueprintData) => ({
    ...blueprintData,
    input: (thing: RuntimeThing) => { /* ... */ },
      // ...
    },
    update: (thing: RuntimeThing, game: GameContext) => {
      // ...
    },
    collision: (
      thing: RuntimeThing,
      other: RuntimeThing,
      game: GameContext
    ) => {
      // ...
    },
    render: (
      thing: RuntimeThing,
      game: GameContext,
      ctx: CanvasRenderingContext2D
    ) => {
      // ...
    },
  }),
});

export const Blueprint = BlueprintDefinition;

export default function createBlueprint(data: BlueprintData<BlueprintData>) {
  return BlueprintDefinition.createBlueprint(data);
}
```

## Data structures

- Blueprint shape is defined by `type BlueprintData` in `app/engine/types.ts`.
- Thing shape is defined by `type RawThing` in `app/engine/types.ts`.
- Things can have custom data at `data`. The type of this data is defined in the
  thing's blueprint's `dataSchema` in its [blueprint-name].ts file.

## Data storage

- Game state is stored in the `data/games/[game-name]/game.json`.
- Blueprints are stored in the `data/games/[game-name]/blueprints`.

## Expression

- A blueprint can have
  - width, height
  - An image to render
  - A physics type
  - A weight (mass) and bounce (restitution)
- Blueprint API
  - update, render, input, collision, getAdjustedVelocity
  - All called every frame.
  - See `app/engine/types.ts` for function signatures.
- A thing can have
  - x, y, z, width, height, angle

## Physics

- Blueprints have a physics type that they confer to a thing.
  - static - solid and does not move
  - dynamic - solid and moves when pushed
  - ambient - registers collisions, but other things pass through
- Blueprints define weight (mass, independent of size) and bounce
  (coefficient of restitution).
- Things have a velocityX and velocityY.
- Things have a isGrounded flag to indicates if they're on solid ground.
- Things are automatically kept from overlapping by the physics engine.
- Things are notified of collisions by their blueprint's `collision` function.
- The physics engine supports a fixed gravity (downwards). Whether gravity is on
  or off is specified in `game.json`.
- A blueprint can specify a custom velocity handler by implementing the
  `getAdjustedVelocity` function. E.g. For a boat that can only move when it's
  on water.
