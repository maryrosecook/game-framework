import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";

const PLAYER_SPEED = 3;

export default function createBlueprint3(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, keys: KeyState) => {
      const horizontal = (keys.arrowRight ? 1 : 0) - (keys.arrowLeft ? 1 : 0);
      const vertical = (keys.arrowDown ? 1 : 0) - (keys.arrowUp ? 1 : 0);

      if (horizontal === 0 && vertical === 0) {
        thing.velocityX = 0;
        thing.velocityY = 0;
        return;
      }

      const magnitude = Math.hypot(horizontal, vertical) || 1;
      thing.velocityX = (horizontal / magnitude) * PLAYER_SPEED;
      thing.velocityY = (vertical / magnitude) * PLAYER_SPEED;
    },
    update: (thing: RuntimeThing, _state: RuntimeGameState, _things: RuntimeThing[]) => {
      return thing;
    },
    render: (thing: RuntimeThing, _state: RuntimeGameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
