import { BlueprintData, GameContext, RuntimeThing } from "@/engine/types";

export default function createBlueprint24(data: BlueprintData) {
  const TARGET_BLUEPRINT = "shadow-minion";

  return {
    ...data,
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
  };
}
