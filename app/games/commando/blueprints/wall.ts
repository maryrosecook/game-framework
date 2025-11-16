import { BlueprintData, GameState, Thing, KeyState } from "@/engine/types";

export default function createBlueprint2(data: BlueprintData) {
  return {
    ...data,
    input: (thing: Thing, _state: GameState, _keys: KeyState) => {
      return thing;
    },
    update: (thing: Thing, _state: GameState) => {
      return thing;
    },
    render: (thing: Thing, _state: GameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
