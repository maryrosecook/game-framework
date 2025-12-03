import { defineBlueprint } from "@/engine/blueprints";
import { BlueprintThing, GameContext, KeyState, RuntimeThing } from "@/engine/types";
import { z } from "zod";

const MOVE_SPEED = 6;

const TheseusDataSchema = z.object({ number: z.number().default(0) });

export type TheseusData = z.infer<typeof TheseusDataSchema>;

const TheseusBlueprint = defineBlueprint({
  name: "theseus",
  schema: TheseusDataSchema,
  create: (data) => ({
    ...data,
    input: (thing: RuntimeThing, _game: GameContext, keys: KeyState) => {
      const horizontal = Number(keys.arrowRight) - Number(keys.arrowLeft);
      const vertical = Number(keys.arrowDown) - Number(keys.arrowUp);
      if (horizontal === 0 && vertical === 0) {
        thing.velocityX = 0;
        thing.velocityY = 0;
        return;
      }

      const magnitude = Math.hypot(horizontal, vertical) || 1;
      const normalized = { x: horizontal / magnitude, y: vertical / magnitude };
      thing.velocityX = normalized.x * MOVE_SPEED;
      thing.velocityY = normalized.y * MOVE_SPEED;
    },
    update: (_thing: RuntimeThing, _game: GameContext) => undefined,
    render: (thing: RuntimeThing, _game: GameContext, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  }),
});

export type TheseusThing = BlueprintThing<typeof TheseusBlueprint>;

export default TheseusBlueprint;
