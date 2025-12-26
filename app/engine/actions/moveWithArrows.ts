import { ActionDefinition } from "@/engine/types";

const allowedTriggers: ActionDefinition<"input">["allowedTriggers"] = ["input"];

const moveWithArrows: ActionDefinition<"input"> = {
  summary: "Move with arrow keys in four directions.",
  allowedTriggers,
  code: (thing, _game, keys) => {
    const speed = 6;

    const horizontal = Number(keys.arrowRight) - Number(keys.arrowLeft);
    const vertical = Number(keys.arrowDown) - Number(keys.arrowUp);

    thing.velocityX = horizontal * speed;
    thing.velocityY = vertical * speed;
  },
};

export default moveWithArrows;
