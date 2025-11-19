import {
  BlueprintData,
  RuntimeGameState,
  RuntimeThing,
  KeyState,
} from "@/engine/types";
import { normalizeName } from "@/engine/reducer";

export default function createBlueprint3(data: BlueprintData) {
  return {
    ...data,
    input: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
      _keys: KeyState
    ) => {
      return thing;
    },
    update: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
      _things: RuntimeThing[]
    ) => {
      return thing;
    },
    collision: (
      thing: RuntimeThing,
      other: RuntimeThing,
      gameState: RuntimeGameState
    ) => {
      const targetIsCharacter = isCharacter(other);
      gameState.things = gameState.things.filter((candidate) => {
        if (candidate.id === thing.id) return false;
        if (targetIsCharacter && candidate.id === other.id) return false;
        return true;
      });
    },
  };
}

function isCharacter(thing: RuntimeThing) {
  const name = normalizeName(thing.blueprintName);
  return name === "player" || name === "enemy";
}
