import { defineBlueprint } from "@/engine/blueprints";
import {
  BlueprintDefinition,
  GameContext,
  KeyState,
  RuntimeThing,
} from "@/engine/types";

export function createSolidFillBlueprint<Name extends string>(
  name: Name
): BlueprintDefinition<Name> {
  return defineBlueprint({
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
}
