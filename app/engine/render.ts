import { getBlueprintForThing } from "./blueprints";
import { createThingStack } from "./thingStacking";
import { Blueprint, GameContext, RuntimeThing } from "./types";

type RenderConfig = {
  ctx: CanvasRenderingContext2D;
  viewport: { width: number; height: number };
};

export type PaintOverlay = {
  selectedThingId: string | null;
  hoverPixel: { x: number; y: number } | null;
  color: string;
  gridColor: string;
};

const RESIZE_HANDLE_SIZE = 12;

export function renderGame(
  { ctx, viewport }: RenderConfig,
  game: GameContext,
  blueprintLookup: Map<string, Blueprint>,
  getImageForThing?: (
    thing: RuntimeThing,
    blueprint?: Blueprint
  ) => CanvasImageSource | null,
  paintOverlay?: PaintOverlay
) {
  const state = game.gameState;
  const { canvas } = ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  ctx.fillStyle = state.backgroundColor;
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

  const stacking = createThingStack(state.things, blueprintLookup);
  for (const thing of stacking) {
    renderThing(
      ctx,
      thing,
      game,
      blueprintLookup,
      getImageForThing,
      paintOverlay
    );
  }

  ctx.restore();
}

function renderThing(
  ctx: CanvasRenderingContext2D,
  thing: RuntimeThing,
  game: GameContext,
  blueprintLookup: Map<string, Blueprint>,
  getImageForThing?: (
    thing: RuntimeThing,
    blueprint?: Blueprint
  ) => CanvasImageSource | null,
  paintOverlay?: PaintOverlay
) {
  ctx.save();
  ctx.translate(thing.x + thing.width / 2, thing.y + thing.height / 2);
  ctx.rotate((thing.angle * Math.PI) / 180);
  ctx.translate(-thing.width / 2, -thing.height / 2);

  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  const renderer = blueprint?.render;
  const shape = blueprint?.shape ?? "rectangle";
  const image = getImageForThing ? getImageForThing(thing, blueprint) : null;
  const imageReady = isImageReady(image);

  ctx.imageSmoothingEnabled = false;

  if (imageReady && image) {
    ctx.drawImage(image, 0, 0, thing.width, thing.height);
  } else if (renderer) {
    renderer(thing, game, ctx);
  } else {
    ctx.fillStyle = thing.color || blueprint?.color || "#888";
    if (shape === "triangle") {
      drawTriangle(ctx, thing.width, thing.height);
    } else if (shape === "circle") {
      drawCircle(ctx, thing.width);
    } else {
      ctx.fillRect(0, 0, thing.width, thing.height);
    }
  }

  const isSelected =
    game.gameState.selectedThingIds.includes(thing.id) ||
    game.gameState.selectedThingId === thing.id;

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(-2, -2, thing.width + 4, thing.height + 4);
    ctx.restore();

    if (game.gameState.selectedThingId === thing.id) {
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

  // Paint grid + hover preview for paint mode.
  if (paintOverlay?.selectedThingId === thing.id) {
    const gridColor = paintOverlay.gridColor;
    const stepX = thing.width / 16;
    const stepY = thing.height / 16;
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    // Vertical lines
    for (let i = 0; i <= 16; i += 1) {
      const x = Math.round(i * stepX) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, thing.height);
      ctx.stroke();
    }
    // Horizontal lines
    for (let j = 0; j <= 16; j += 1) {
      const y = Math.round(j * stepY) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(thing.width, y);
      ctx.stroke();
    }
    ctx.restore();

    if (paintOverlay.hoverPixel) {
      const { x, y } = paintOverlay.hoverPixel;
      const pixelX = x * stepX;
      const pixelY = y * stepY;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = paintOverlay.color;
      ctx.fillRect(pixelX, pixelY, stepX, stepY);
      ctx.restore();
    }
  }

  ctx.restore();
}

function isImageReady(
  image: CanvasImageSource | null
): image is CanvasImageSource {
  if (!image) {
    return false;
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    image instanceof HTMLImageElement
  ) {
    return (
      image.complete &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0
    );
  }
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return image.width > 0 && image.height > 0;
  }
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    image instanceof HTMLCanvasElement
  ) {
    return image.width > 0 && image.height > 0;
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    image instanceof OffscreenCanvas
  ) {
    return image.width > 0 && image.height > 0;
  }
  return true;
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

function drawCircle(ctx: CanvasRenderingContext2D, diameter: number) {
  const radius = diameter / 2;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}
