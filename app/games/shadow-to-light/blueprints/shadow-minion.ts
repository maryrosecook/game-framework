import { BlueprintData, GameContext, RuntimeThing, KeyState } from "@/engine/types";

const LETHAL_TARGETS = new Set(["player", "wolf"]);

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _game: GameContext, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _game: GameContext) => {
      return thing;
    },
    collision: (_thing: RuntimeThing, other: RuntimeThing, game: GameContext) => {
      if (!LETHAL_TARGETS.has(other.blueprintName)) {
        return;
      }

      game.destroy(other);
    },
    render: (thing: RuntimeThing, _game: GameContext, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
