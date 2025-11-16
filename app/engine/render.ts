import { getBlueprintForThing } from "./blueprints";
import { Blueprint, GameState, Thing } from "./types";

type RenderConfig = {
  ctx: CanvasRenderingContext2D;
  viewport: { width: number; height: number };
};

export function renderGame(
  { ctx, viewport }: RenderConfig,
  state: GameState,
  blueprintLookup: Map<string, Blueprint>
) {
  const { canvas } = ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const screenOffsetX = (viewport.width - state.screen.width) / 2;
  const screenOffsetY = (viewport.height - state.screen.height) / 2;

  ctx.save();
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(
    screenOffsetX,
    screenOffsetY,
    state.screen.width,
    state.screen.height
  );
  ctx.restore();

  ctx.save();
  ctx.translate(screenOffsetX - state.camera.x, screenOffsetY - state.camera.y);

  const sorted = [...state.things].sort((a, b) => a.z - b.z);
  for (const thing of sorted) {
    renderThing(ctx, thing, state, blueprintLookup);
  }

  ctx.restore();
}

function renderThing(
  ctx: CanvasRenderingContext2D,
  thing: Thing,
  state: GameState,
  blueprintLookup: Map<string, Blueprint>
) {
  ctx.save();
  ctx.translate(thing.x + thing.width / 2, thing.y + thing.height / 2);
  ctx.rotate((thing.angle * Math.PI) / 180);
  ctx.translate(-thing.width / 2, -thing.height / 2);

  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  const renderer = blueprint?.render;
  if (renderer) {
    renderer(thing, state, ctx);
  } else {
    ctx.fillStyle = thing.color || blueprint?.color || "#888";
    ctx.fillRect(0, 0, thing.width, thing.height);
  }

  if (state.selectedThingId === thing.id) {
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(-2, -2, thing.width + 4, thing.height + 4);
    ctx.restore();
  }

  ctx.restore();
}
