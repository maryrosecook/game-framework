import { BlueprintData, GameContext, RuntimeThing } from "@/engine/types";
import { renderImage } from "@/engine/engine";
import { FOV_DEGREES, NEAR_CLIP, TARGET_WORLD_SIZE } from "./constants";
import { getPlayerBasis } from "./player";
import { Vector3, dot3, length3, subtract3 } from "./math";
import { PlayerData, TargetData } from "./types";

export default function createTargetBlueprint(data: BlueprintData<TargetData>) {
  return {
    ...data,
    render: (
      thing: RuntimeThing<TargetData>,
      game: GameContext,
      ctx: CanvasRenderingContext2D
    ) => {
      const targetData = ensureTargetData(thing);
      const player = game.gameState.things.find(
        (candidate): candidate is RuntimeThing<PlayerData> =>
          candidate.blueprintName === "player"
      );
      if (!player?.data) {
        return;
      }

      const basis = getPlayerBasis(player.data);
      const toTarget = subtract3(targetData.position, player.data.position);
      const cameraSpace = toCameraSpace(toTarget, basis);
      const distanceToTarget = length3(toTarget);
      if (cameraSpace.z <= NEAR_CLIP || distanceToTarget === 0) {
        return;
      }

      const screen = game.gameState.screen;
      const canvas = ctx.canvas;
      const focalLength =
        (0.5 * screen.height) / Math.tan((FOV_DEGREES * Math.PI) / 360);
      const sizeScale = focalLength / distanceToTarget;
      const projectedSize = TARGET_WORLD_SIZE * sizeScale;
      const offsetX = (canvas.width - screen.width) / 2;
      const offsetY = (canvas.height - screen.height) / 2;
      const projectedX = (cameraSpace.x / cameraSpace.z) * focalLength;
      const projectedY = (cameraSpace.y / cameraSpace.z) * focalLength;
      const centerX = offsetX + screen.width / 2 + projectedX;
      const centerY = offsetY + screen.height / 2 - projectedY;
      const image = game.getImageForThing(thing);
      const imageReady = isImageReady(image);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.translate(centerX - projectedSize / 2, centerY - projectedSize / 2);
      if (imageReady && image) {
        const renderThing: RuntimeThing<TargetData> = {
          ...thing,
          width: projectedSize,
          height: projectedSize,
        };
        renderImage(game.getImageForThing, ctx, renderThing);
      } else {
        ctx.fillStyle = thing.color;
        ctx.fillRect(0, 0, projectedSize, projectedSize);
      }
      ctx.restore();
    },
  };
}

function ensureTargetData(target: RuntimeThing<TargetData>): TargetData {
  const fallback = target.data ?? {
    position: { x: target.x, y: target.y, z: 0 },
  };
  target.data = fallback;
  return fallback;
}

function toCameraSpace(
  worldVector: Vector3,
  basis: { forward: Vector3; right: Vector3; up: Vector3 }
) {
  return {
    x: dot3(worldVector, basis.right),
    y: dot3(worldVector, basis.up),
    z: dot3(worldVector, basis.forward),
  };
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
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
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
