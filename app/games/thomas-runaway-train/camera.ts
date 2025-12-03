import { RuntimeGameState, Vector } from "@/engine/types";

export default function updateCamera(game: RuntimeGameState): Vector {
  return game.camera;
}
