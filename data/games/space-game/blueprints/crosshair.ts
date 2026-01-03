import { BlueprintData, GameContext, RuntimeThing } from "@/engine/types";
import { isLaserActive } from "./player";
import { PlayerData } from "./types";

export default function createCrosshairBlueprint(data: BlueprintData) {
  return {
    ...data,
    render: (
      _thing: RuntimeThing,
      game: GameContext,
      ctx: CanvasRenderingContext2D
    ) => {
      const canvas = ctx.canvas;
      const screen = game.gameState.screen;
      const offsetX = (canvas.width - screen.width) / 2;
      const offsetY = (canvas.height - screen.height) / 2;
      const centerX = offsetX + screen.width / 2;
      const centerY = offsetY + screen.height / 2;
      const armLength = Math.min(screen.width, screen.height) * 0.05;
      const lineWidth = 2;

      const player = game.gameState.things.find(
        (candidate): candidate is RuntimeThing<PlayerData> =>
          candidate.blueprintName === "player"
      );
      const now = Date.now();
      const laserActive =
        player?.data !== undefined &&
        isLaserActive(player.data, now);

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = "#c7c7c7";
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(centerX - armLength, centerY);
      ctx.lineTo(centerX + armLength, centerY);
      ctx.moveTo(centerX, centerY - armLength);
      ctx.lineTo(centerX, centerY + armLength);
      ctx.stroke();

      if (laserActive) {
        const flashRadius = Math.max(armLength * 0.15, 6);
        ctx.fillStyle = "#bbbbbb";
        ctx.beginPath();
        ctx.arc(centerX, centerY, flashRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}
