import { BlueprintData, GameContext, RuntimeThing } from "@/engine/types";
import { FOV_DEGREES, NEAR_CLIP, TARGET_WORLD_SIZE } from "./constants";
import { getPlayerBasis } from "./player";
import { Vector3, dot3, subtract3 } from "./math";
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
      if (cameraSpace.z <= NEAR_CLIP) {
        return;
      }

      const screen = game.gameState.screen;
      const canvas = ctx.canvas;
      const focalLength =
        (0.5 * screen.height) / Math.tan((FOV_DEGREES * Math.PI) / 360);
      const scale = focalLength / cameraSpace.z;
      const projectedSize = TARGET_WORLD_SIZE * scale;
      const offsetX = (canvas.width - screen.width) / 2;
      const offsetY = (canvas.height - screen.height) / 2;
      const centerX = offsetX + screen.width / 2 + cameraSpace.x * scale;
      const centerY = offsetY + screen.height / 2 - cameraSpace.y * scale;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#8b8b8b";
      ctx.fillRect(
        centerX - projectedSize / 2,
        centerY - projectedSize / 2,
        projectedSize,
        projectedSize
      );
      ctx.restore();
    },
  };
}

function ensureTargetData(target: RuntimeThing<TargetData>): TargetData {
  const fallback = target.data ?? { position: { x: target.x, y: target.y, z: 0 } };
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
