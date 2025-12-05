import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, keys: KeyState) => {
      const speed = 6;
      thing.velocityX = 0;

      if (keys.arrowLeft !== keys.arrowRight) {
        thing.velocityX = keys.arrowLeft ? -speed : speed;
      }

      if (keys.arrowUp && thing.isGrounded) {
        thing.velocityY = -5;
      }
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
