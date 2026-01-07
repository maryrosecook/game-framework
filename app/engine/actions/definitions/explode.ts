import {
  ActionDefinition,
  RuntimeThing,
  TriggerName,
  Vector,
} from "@/engine/types";
import {
  EXPLODED_PIXEL_BLUEPRINT_NAME,
  ExplodedPixelData,
} from "@/engine/internal/explodedPixel";
import { getColorOptions } from "@/lib/colors";

type Rotation = {
  cos: number;
  sin: number;
};

const allowedTriggers: ActionDefinition<TriggerName>["allowedTriggers"] = [
  "create",
  "input",
  "update",
  "collision",
];

const COLOR_OPTION_BLUEPRINT = "blueprint";
const COLOR_OPTIONS = [COLOR_OPTION_BLUEPRINT, ...getColorOptions()];

const explode: ActionDefinition<
  TriggerName,
  {
    speed: { kind: "number"; default: number; min: number };
    color: { kind: "enum"; default: string; options: string[] };
  }
> = {
  allowedTriggers,
  settings: {
    speed: { kind: "number", default: 2, min: 0 },
    color: { kind: "enum", default: COLOR_OPTION_BLUEPRINT, options: COLOR_OPTIONS },
  },
  code: ({ thing, game, settings }) => {
    if (!Number.isFinite(thing.width) || !Number.isFinite(thing.height)) {
      return;
    }
    if (thing.width <= 0 || thing.height <= 0) {
      return;
    }

    const image = game.getImageForThing(thing);
    const imageSize = image ? getImageDimensions(image) : null;
    const gridWidth = imageSize
      ? Math.max(1, Math.round(imageSize.width))
      : Math.max(1, Math.round(thing.width));
    const gridHeight = imageSize
      ? Math.max(1, Math.round(imageSize.height))
      : Math.max(1, Math.round(thing.height));

    if (gridWidth <= 0 || gridHeight <= 0) {
      return;
    }

    const pixelWidth = thing.width / gridWidth;
    const pixelHeight = thing.height / gridHeight;

    if (
      !Number.isFinite(pixelWidth) ||
      !Number.isFinite(pixelHeight) ||
      pixelWidth <= 0 ||
      pixelHeight <= 0
    ) {
      return;
    }

    const speed = Number.isFinite(settings.speed)
      ? Math.max(0, settings.speed)
      : 0;
    const colorChoice =
      typeof settings.color === "string" ? settings.color : COLOR_OPTION_BLUEPRINT;
    const overrideColor = resolveOverrideColor(colorChoice);
    const rotation = getRotation(thing.angle);
    const center = getThingCenter(thing);

    for (let y = 0; y < gridHeight; y += 1) {
      for (let x = 0; x < gridWidth; x += 1) {
        const position = getPixelWorldPosition(
          x,
          y,
          pixelWidth,
          pixelHeight,
          thing,
          center,
          rotation
        );
        const data = createExplodedPixelData(thing, overrideColor);
        const spawned = game.spawn({
          blueprint: EXPLODED_PIXEL_BLUEPRINT_NAME,
          position,
          overrides: {
            width: pixelWidth,
            height: pixelHeight,
            angle: thing.angle,
            z: thing.z,
            data,
          },
        });
        if (!spawned) {
          continue;
        }

        const velocity = getExplosionVelocity(position, center, speed);
        spawned.velocityX = velocity.x;
        spawned.velocityY = velocity.y;
      }
    }
  },
};

function createExplodedPixelData(
  thing: RuntimeThing,
  overrideColor: string | undefined
): ExplodedPixelData {
  if (!overrideColor) {
    return { sourceBlueprintName: thing.blueprintName };
  }
  return { sourceBlueprintName: thing.blueprintName, overrideColor };
}

function resolveOverrideColor(colorChoice: string): string | undefined {
  if (colorChoice === COLOR_OPTION_BLUEPRINT) {
    return undefined;
  }
  return colorChoice;
}

function getImageDimensions(
  image: CanvasImageSource
): { width: number; height: number } | null {
  if ("naturalWidth" in image && "naturalHeight" in image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (typeof width === "number" && typeof height === "number") {
      if (Number.isFinite(width) && Number.isFinite(height)) {
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }
  }

  if ("videoWidth" in image && "videoHeight" in image) {
    const width = image.videoWidth;
    const height = image.videoHeight;
    if (typeof width === "number" && typeof height === "number") {
      if (Number.isFinite(width) && Number.isFinite(height)) {
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }
  }

  if ("width" in image && "height" in image) {
    const width = image.width;
    const height = image.height;
    if (typeof width === "number" && typeof height === "number") {
      if (Number.isFinite(width) && Number.isFinite(height)) {
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
    }
  }

  return null;
}

function getRotation(angle: number): Rotation {
  const radians = (angle * Math.PI) / 180;
  return { cos: Math.cos(radians), sin: Math.sin(radians) };
}

function getThingCenter(thing: RuntimeThing): Vector {
  return {
    x: thing.x + thing.width / 2,
    y: thing.y + thing.height / 2,
  };
}

function getPixelWorldPosition(
  pixelX: number,
  pixelY: number,
  pixelWidth: number,
  pixelHeight: number,
  thing: RuntimeThing,
  center: Vector,
  rotation: Rotation
): Vector {
  const localX = (pixelX + 0.5) * pixelWidth - thing.width / 2;
  const localY = (pixelY + 0.5) * pixelHeight - thing.height / 2;
  const rotatedX = localX * rotation.cos - localY * rotation.sin;
  const rotatedY = localX * rotation.sin + localY * rotation.cos;
  return {
    x: center.x + rotatedX,
    y: center.y + rotatedY,
  };
}

function getExplosionVelocity(
  position: Vector,
  center: Vector,
  speed: number
): Vector {
  if (!Number.isFinite(speed) || speed <= 0) {
    return { x: 0, y: 0 };
  }
  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) {
    return randomDirection(speed);
  }
  const scale = jitterSpeed(speed) / length;
  const base = { x: dx * scale, y: dy * scale };
  return addSidewaysJitter(base, speed);
}

function randomDirection(speed: number): Vector {
  const jittered = jitterSpeed(speed);
  if (!Number.isFinite(jittered) || jittered <= 0) {
    return { x: 0, y: 0 };
  }
  const angle = Math.random() * Math.PI * 2;
  const base = {
    x: Math.cos(angle) * jittered,
    y: Math.sin(angle) * jittered,
  };
  return addSidewaysJitter(base, jittered);
}

function jitterSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 0;
  }
  const jitter = 0.9 + Math.random() * 0.2;
  return speed * jitter;
}

function addSidewaysJitter(velocity: Vector, speed: number): Vector {
  const length = Math.hypot(velocity.x, velocity.y);
  if (!Number.isFinite(length) || length <= 0) {
    return velocity;
  }
  const perpendicular = { x: -velocity.y / length, y: velocity.x / length };
  const jitter = (Math.random() * 2 - 1) * speed * 0.15;
  return {
    x: velocity.x + perpendicular.x * jitter,
    y: velocity.y + perpendicular.y * jitter,
  };
}

export default explode;
