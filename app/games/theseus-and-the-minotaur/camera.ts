import { RuntimeGameState, Vector } from "@/engine/types";

export function update(game: RuntimeGameState): Vector {
  const theseus = game.things.find(
    (thing) => thing.blueprintName === "theseus"
  );
  if (!theseus) {
    return game.camera;
  }

  const center = {
    x: theseus.x + theseus.width / 2,
    y: theseus.y + theseus.height / 2,
  };

  return {
    x: center.x - game.screen.width / 2,
    y: center.y - game.screen.height / 2,
  };
}

export default { update };
