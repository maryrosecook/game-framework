import { RuntimeGameState, Vector } from "@/engine/types";

export default function updateCamera(game: RuntimeGameState): Vector {
  const player = game.things.find((thing) => thing.blueprintName === "player");
  if (!player) {
    return game.camera;
  }

  const center = {
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
  };

  return {
    x: center.x - game.screen.width / 2,
    y: center.y - game.screen.height / 2,
  };
}
