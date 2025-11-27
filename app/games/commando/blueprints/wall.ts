import { BlueprintData, GameContext, RuntimeThing, KeyState } from "@/engine/types";

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (
      thing: RuntimeThing,
      _game: GameContext,
      _keys: KeyState
    ) => {
      return thing;
    },
    update: () => {},
  };
}
