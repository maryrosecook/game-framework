import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";

export default function createBlueprint24(data: BlueprintData) {
  const TARGET_BLUEPRINT = "shadow-minion";

  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _state: RuntimeGameState, _things: RuntimeThing[]) => {
      return thing;
    },
    collision: (
      thing: RuntimeThing,
      other: RuntimeThing,
      gameState: RuntimeGameState
    ) => {
      if (other.blueprintName !== TARGET_BLUEPRINT) {
        return;
      }

      gameState.things = gameState.things.filter(
        (candidate) => candidate.id !== other.id && candidate.id !== thing.id
      );
    },
    render: (thing: RuntimeThing, _state: RuntimeGameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
