# Game framework

## Setup

```bash
bun install
```

## Run

- Run the server.

```bash
bun dev
```

- Open localhost (probably http://localhost:3000).

## How to

1. Try out the games on the home screen to get a feel for what's possible.
2. Create a new game by clicking the "New Game" tile.

## Orientation

- Game objects are things, and inherit from a blueprint.
- Blueprints specify image, shape, color, physics type and behavior.
- Things override x, y, width, height, angle of their blueprint.

## Features

- Create a blueprint by clicking the + button on the toolbar.
- Create a thing by draggig a blueprint from the toolbar onto the canvas.
- Edit blueprint behavior in /blueprints/[blueprint-name].ts
- Click the brush tool and draw directly onto a thing to edit its blueprint's image.
