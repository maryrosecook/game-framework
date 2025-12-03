import { defineBlueprint } from "@/engine/blueprints";
import {
  BlueprintData,
  GameContext,
  KeyState,
  RuntimeThing,
} from "@/engine/types";

export function createSolidFillBlueprint<Name extends string>(name: Name) {
  const definition = defineBlueprint({
    name,
    create: (data) => ({
      ...data,
      input: (_thing: RuntimeThing, _game: GameContext, _keys: KeyState) => {},
      update: (_thing: RuntimeThing, _game: GameContext) => undefined,
      render: (
        thing: RuntimeThing,
        _game: GameContext,
        ctx: CanvasRenderingContext2D
      ) => {
        ctx.fillStyle = thing.color;
        ctx.fillRect(0, 0, thing.width, thing.height);
      },
    }),
  });

  const createBlueprint = (data: BlueprintData) =>
    definition.createBlueprint(data);

  return createBlueprint;
}
