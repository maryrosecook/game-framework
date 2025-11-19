import {
  BlueprintData,
  RuntimeGameState,
  RuntimeThing,
  KeyState,
} from "@/engine/types";

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
      _keys: KeyState
    ) => {
      return thing;
    },
    update: () => {},
  };
}
