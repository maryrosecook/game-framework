import {
  BlueprintData,
  GameContext,
  RuntimeThing,
  KeyState,
} from "@/engine/types";
import { renderImage } from "@/engine/engine";

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _game: GameContext, keys: KeyState) => {
      const speed = 6;
      thing.velocityX = 0;

      if (keys.arrowLeft !== keys.arrowRight) {
        thing.velocityX = keys.arrowLeft ? -speed : speed;
      }

      if (keys.arrowUp && thing.isGrounded) {
        thing.velocityY = -5;
      }
    },
  };
}
