import { ActionDefinition } from "@/engine/types";

const allowedTriggers: ActionDefinition<"update">["allowedTriggers"] = [
  "update",
];

const cameraFollow: ActionDefinition<"update", {}> = {
  allowedTriggers,
  settings: {},
  code: ({ thing, game }) => {
    const camera = game.gameState.camera;
    const screen = game.gameState.screen;
    const centerX = thing.x + thing.width / 2;
    const centerY = thing.y + thing.height / 2;

    camera.x = centerX - screen.width / 2;
    camera.y = centerY - screen.height / 2;
  },
};

export default cameraFollow;
