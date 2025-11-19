import { RuntimeGameState, Vector } from "@/engine/types";
import { normalizeName } from "@/engine/reducer";

function getPlayer(game: RuntimeGameState) {
  return game.things.find(
    (thing) => normalizeName(thing.blueprintName) === "player"
  );
}

export function update(game: RuntimeGameState): Vector {
  const player = getPlayer(game);
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

export default { update };
