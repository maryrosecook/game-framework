import { BlueprintData, GameState, KeyState, Thing } from "@/engine/types";

const MOVE_SPEED = 3;

export default function createPlayerBlueprint(data: BlueprintData) {
  return {
    ...data,
    input: (thing: Thing, _gameState: GameState, keys: KeyState) => {
      thing.velocity.x = 0;
      thing.velocity.y = 0;
      if (keys.arrowLeft) {
        thing.velocity.x -= MOVE_SPEED;
      }
      if (keys.arrowRight) {
        thing.velocity.x += MOVE_SPEED;
      }
      if (keys.arrowUp) {
        thing.velocity.y -= MOVE_SPEED;
      }
      if (keys.arrowDown) {
        thing.velocity.y += MOVE_SPEED;
      }
    },
    update: (thing: Thing) => {
      // Slight damping to make the player feel less slippery.
      thing.velocity.x *= 0.95;
      thing.velocity.y *= 0.95;
    },
    render: (thing: Thing, _gameState: GameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
    collision: (thing: Thing) => {
      thing.velocity.x = 0;
      thing.velocity.y = 0;
    },
  };
}
