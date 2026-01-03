import { BlueprintData, GameContext, RuntimeThing } from "@/engine/types";
import { advanceApproach } from "../obstacleApproach";
import { renderImage } from "@/engine/engine";

export default function createTree(data: BlueprintData) {
  const baseSize = { width: data.width, height: data.height };
  return {
    ...data,
    update: (thing: RuntimeThing, game: GameContext) => {
      advanceApproach(thing, game, baseSize);
    },
  };
}
