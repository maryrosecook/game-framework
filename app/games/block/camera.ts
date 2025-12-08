import { RuntimeGameState, Vector } from "@/engine/types";

export default function updateCamera(game: RuntimeGameState): Vector {
  const target = game.things.find(
    (thing) => thing.blueprintName === "camera-focus"
  );

  if (!target) {
    return game.camera;
  }

  const centerX = target.x + target.width / 2;
  const centerY = target.y + target.height / 2;

  return {
    x: centerX - game.screen.width / 2,
    y: centerY - game.screen.height / 2,
  };
}
