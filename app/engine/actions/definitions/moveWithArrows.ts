import { ActionDefinition } from "@/engine/types";

const allowedTriggers: ActionDefinition<"input" | "update">["allowedTriggers"] =
  ["input", "update"];

const moveWithArrows: ActionDefinition<
  "input" | "update",
  { speed: { kind: "number"; default: number } }
> = {
  allowedTriggers,
  settings: {
    speed: { kind: "number", default: 2 },
  },
  code: ({ thing, settings, keyState }) => {
    const speed = settings.speed;

    const left = keyState.arrowLeft || keyState.keyA;
    const right = keyState.arrowRight || keyState.keyD;
    const up = keyState.arrowUp || keyState.keyW;
    const down = keyState.arrowDown || keyState.keyS;

    if (!(left || right || up || down)) {
      thing.velocityX = 0;
      thing.velocityY = 0;
      return;
    }

    const horizontal = Number(right) - Number(left);
    const vertical = Number(down) - Number(up);

    thing.velocityX = horizontal * speed;
    thing.velocityY = vertical * speed;
  },
};

export default moveWithArrows;
