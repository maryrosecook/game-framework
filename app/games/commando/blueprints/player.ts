import {
  BlueprintData,
  RuntimeGameState,
  KeyState,
  RuntimeThing,
} from "@/engine/types";

const MOVE_SPEED = 3;

export default function createPlayerBlueprint(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _gameState: RuntimeGameState, keys: KeyState) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
      if (keys.arrowLeft) {
        thing.velocityX -= MOVE_SPEED;
      }
      if (keys.arrowRight) {
        thing.velocityX += MOVE_SPEED;
      }
      if (keys.arrowUp) {
        thing.velocityY -= MOVE_SPEED;
      }
      if (keys.arrowDown) {
        thing.velocityY += MOVE_SPEED;
      }
    },
    update: (thing: RuntimeThing) => {
      // Slight damping to make the player feel less slippery.
      thing.velocityX *= 0.95;
      thing.velocityY *= 0.95;
    },
    render: (
      thing: RuntimeThing,
      _gameState: RuntimeGameState,
      ctx: CanvasRenderingContext2D
    ) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
    collision: (thing: RuntimeThing) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
    },
  };
}
