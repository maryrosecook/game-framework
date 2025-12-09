# Game making

## Overview

- This document is a guide for how to make a game using the game framework.
- To understand which game is being edited, look in the `data/editorSettings.json`.

## Game structure

- 2D game framework with basic SAT physics.
- Game objects are called things.
- Game objects inherit from a blueprint.
- Blueprints specify image, shape, color, physics type and behavior.
- A blueprint's behavior is implemented in `app/games/[game-name]/blueprints/[blueprint-name].ts`.
- Things have x, y. They can override x, y, width, height, angle of their blueprint.

## Data structures

- Blueprint shape is defined by `type BlueprintData` in `app/engine/types.ts`.
- Thing shape is defined by `type RawThing` in `app/engine/types.ts`.
- Things can have custom data at `data`. The type of this data is defined in the thing's blueprint's `dataSchema` in its [blueprint-name].ts file.

## Data storage

- Game state is stored in the `app/games/[game-name]/game.json`.
- Blueprints are stored in the `app/games/[game-name]/blueprints`.

## Expression

- A blueprint can have
  - z, width, height
  - An image to render
  - A physics type
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
- Things have a velocityX and velocityY.
- Things have a isGrounded flag to indicates if they're on solid ground.
- Things are automatically kept from overlapping by the physics engine.
- Things are notified of collisions by their blueprint's `collision` function.
- The physics engine supports a fixed gravity (downwards). Whether gravity is on
  or off is specified in `game.json`.
- A blueprint can specify a custom velocity handler by implementing the
  `getAdjustedVelocity` function. E.g. For a boat that can only move when it's on water.
