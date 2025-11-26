import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";

const LETHAL_TARGETS = new Set(["player", "wolf"]);

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _state: RuntimeGameState, _things: RuntimeThing[]) => {
      return thing;
    },
    collision: (_thing: RuntimeThing, other: RuntimeThing, gameState: RuntimeGameState) => {
      if (!LETHAL_TARGETS.has(other.blueprintName)) {
        return;
      }

      gameState.things = gameState.things.filter(
        (candidate) => candidate.id !== other.id
      );
    },
    render: (thing: RuntimeThing, _state: RuntimeGameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
