import {
  BlueprintData,
  GameContext,
  RuntimeThing,
  KeyState,
} from "@/engine/types";

const LETHAL_TARGETS = new Set(["player", "wolf"]);

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    collision: (
      _thing: RuntimeThing,
      other: RuntimeThing,
      game: GameContext
    ) => {
      if (!LETHAL_TARGETS.has(other.blueprintName)) {
        return;
      }

      game.destroy(other);
    },
  };
}
