import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";

export default function createBlueprint6(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _state: RuntimeGameState, _things: RuntimeThing[]) => {
      return thing;
    },
    render: (thing: RuntimeThing, _state: RuntimeGameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      if (thing.width === thing.height && thing.width > 0 && data.shape === "circle") {
        const radius = thing.width / 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else if (data.shape === "triangle") {
        ctx.beginPath();
        ctx.moveTo(0, thing.height);
        ctx.lineTo(thing.width / 2, 0);
        ctx.lineTo(thing.width, thing.height);
        ctx.closePath();
        ctx.fill();
      } else if (data.shape === "circle") {
        const radius = Math.min(thing.width, thing.height) / 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, thing.width, thing.height);
      }
    },
  };
}
