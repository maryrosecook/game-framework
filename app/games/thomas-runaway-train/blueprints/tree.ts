import { BlueprintData, GameContext, RuntimeThing } from "@/engine/types";
import { advanceApproach } from "../obstacleApproach";

export default function createTree(data: BlueprintData) {
  const baseSize = { width: data.width, height: data.height };
  return {
    ...data,
    update: (thing: RuntimeThing, game: GameContext) => {
      advanceApproach(thing, game, baseSize);
    },
    render: (thing: RuntimeThing, _game: GameContext, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
