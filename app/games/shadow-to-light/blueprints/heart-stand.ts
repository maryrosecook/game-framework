import { BlueprintData, GameContext, RuntimeThing, KeyState } from "@/engine/types";

export default function createBlueprint15(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _game: GameContext, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _game: GameContext) => {
      return thing;
    },
    render: (thing: RuntimeThing, _game: GameContext, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
