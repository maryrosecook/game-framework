import {
  Blueprint,
  GameContext,
  RuntimeThing,
  isRecord,
} from "@/engine/types";

export const EXPLODED_PIXEL_BLUEPRINT_NAME = "__explodedPixel";

export type ExplodedPixelData = {
  sourceBlueprintName: string;
  overrideColor?: string;
};

export const explodedPixelBlueprint: Blueprint = {
  name: EXPLODED_PIXEL_BLUEPRINT_NAME,
  width: 1,
  height: 1,
  color: "#000000",
  shape: "rectangle",
  physicsType: "ambient",
  weight: 1,
  bounce: 0,
  render: renderExplodedPixel,
};

function renderExplodedPixel(
  thing: RuntimeThing,
  game: GameContext,
  ctx: CanvasRenderingContext2D
) {
  const data = thing.data;
  if (!isExplodedPixelData(data)) {
    fillWithColor(ctx, thing, "#888");
    return;
  }

  const fallbackColor = getSourceBlueprintColor(
    game,
    data.sourceBlueprintName
  );
  const color = data.overrideColor ?? fallbackColor;
  fillWithColor(ctx, thing, color);
}

function fillWithColor(
  ctx: CanvasRenderingContext2D,
  thing: RuntimeThing,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, thing.width, thing.height);
}

function getSourceBlueprintColor(
  game: GameContext,
  sourceBlueprintName: string
): string {
  const blueprint = game.gameState.blueprints.find(
    (entry) => entry.name === sourceBlueprintName
  );
  return blueprint?.color ?? "#888";
}

function isExplodedPixelData(value: unknown): value is ExplodedPixelData {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.sourceBlueprintName === "string" &&
    value.sourceBlueprintName.length > 0 &&
    (value.overrideColor === undefined ||
      typeof value.overrideColor === "string")
  );
}
