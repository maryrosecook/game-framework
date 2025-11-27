import { BlueprintData, GameContext, RuntimeThing, KeyState } from "@/engine/types";

export default function createBlueprint24(data: BlueprintData) {
  const TARGET_BLUEPRINT = "shadow-minion";

  return {
    ...data,
    input: (thing: RuntimeThing, _game: GameContext, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _game: GameContext) => {
      return thing;
    },
    collision: (
      thing: RuntimeThing,
      other: RuntimeThing,
      game: GameContext
    ) => {
      if (other.blueprintName !== TARGET_BLUEPRINT) {
        return;
      }

      game.destroy(other);
      game.destroy(thing);
    },
    render: (thing: RuntimeThing, _game: GameContext, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
