import {
  BlueprintData,
  RuntimeGameState,
  RuntimeThing,
  KeyState,
} from "@/engine/types";

const MOVE_SPEED = 6;

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, keys: KeyState) => {
      const horizontal = Number(keys.arrowRight) - Number(keys.arrowLeft);
      const vertical = Number(keys.arrowDown) - Number(keys.arrowUp);
      if (horizontal === 0 && vertical === 0) {
        thing.velocityX = 0;
        thing.velocityY = 0;
        return;
      }

      const magnitude = Math.hypot(horizontal, vertical) || 1;
      const normalized = { x: horizontal / magnitude, y: vertical / magnitude };
      thing.velocityX = normalized.x * MOVE_SPEED;
      thing.velocityY = normalized.y * MOVE_SPEED;
    },
    update: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
      _things: RuntimeThing[]
    ) => {
      return thing;
    },
    render: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
      ctx: CanvasRenderingContext2D
    ) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
