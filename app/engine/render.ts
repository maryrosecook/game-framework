import { getBlueprintForThing } from "./blueprints";
import { Blueprint, RuntimeGameState, RuntimeThing } from "./types";

type RenderConfig = {
  ctx: CanvasRenderingContext2D;
  viewport: { width: number; height: number };
};

const RESIZE_HANDLE_SIZE = 12;

export function renderGame(
  { ctx, viewport }: RenderConfig,
  state: RuntimeGameState,
  blueprintLookup: Map<string, Blueprint>,
  getImageForThing?: (
    thing: RuntimeThing,
    blueprint?: Blueprint
  ) => HTMLImageElement | null
) {
  const { canvas } = ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  if (state.isPaused) {
    ctx.save();
    ctx.font = "100px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#4b5563";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⏸", viewport.width / 2, viewport.height / 2);
    ctx.restore();
  }

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

  const sorted = [...state.things].sort(
    (a, b) =>
      (blueprintLookup.get(a.blueprintName)?.z ?? 1) -
      (blueprintLookup.get(b.blueprintName)?.z ?? 1)
  );
  for (const thing of sorted) {
    renderThing(ctx, thing, state, blueprintLookup, getImageForThing);
  }

  ctx.restore();
}

function renderThing(
  ctx: CanvasRenderingContext2D,
  thing: RuntimeThing,
  state: RuntimeGameState,
  blueprintLookup: Map<string, Blueprint>,
  getImageForThing?: (
    thing: RuntimeThing,
    blueprint?: Blueprint
  ) => HTMLImageElement | null
) {
  ctx.save();
  ctx.translate(thing.x + thing.width / 2, thing.y + thing.height / 2);
  ctx.rotate((thing.angle * Math.PI) / 180);
  ctx.translate(-thing.width / 2, -thing.height / 2);

  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  const renderer = blueprint?.render;
  const shape = thing.shape ?? blueprint?.shape ?? "rectangle";
  const image = getImageForThing?.(thing, blueprint);
  const imageReady =
    !!image &&
    image.complete &&
    image.naturalWidth > 0 &&
    image.naturalHeight > 0;

  ctx.imageSmoothingEnabled = false;

  if (imageReady && image) {
    ctx.drawImage(image, 0, 0, thing.width, thing.height);
  } else if (renderer) {
    renderer(thing, state, ctx);
  } else {
    ctx.fillStyle = thing.color || blueprint?.color || "#888";
    if (shape === "triangle") {
      drawTriangle(ctx, thing.width, thing.height);
    } else {
      ctx.fillRect(0, 0, thing.width, thing.height);
    }
  }

  const isSelected =
    state.selectedThingIds.includes(thing.id) ||
    state.selectedThingId === thing.id;

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(-2, -2, thing.width + 4, thing.height + 4);
    ctx.restore();

    if (state.selectedThingId === thing.id) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.translate(thing.width, thing.height);
      ctx.fillRect(
        -RESIZE_HANDLE_SIZE,
        -RESIZE_HANDLE_SIZE,
        RESIZE_HANDLE_SIZE,
        RESIZE_HANDLE_SIZE
      );
      ctx.strokeRect(
        -RESIZE_HANDLE_SIZE,
        -RESIZE_HANDLE_SIZE,
        RESIZE_HANDLE_SIZE,
        RESIZE_HANDLE_SIZE
      );
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(width / 2, 0);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
}
