import { ActionDefinition, KeyState, RuntimeThing } from "@/engine/types";

const allowedTriggers: ActionDefinition<"input" | "update">["allowedTriggers"] =
  ["input", "update"];

type MoveWithArrowsMode = "sideways" | "turn";

const MOVE_WITH_ARROWS_MODES: MoveWithArrowsMode[] = ["sideways", "turn"];

const moveWithArrows: ActionDefinition<
  "input" | "update",
  {
    move: { kind: "enum"; default: MoveWithArrowsMode; options: MoveWithArrowsMode[] };
    speed: { kind: "number"; default: number };
  }
> = {
  allowedTriggers,
  settings: {
    move: { kind: "enum", default: "sideways", options: MOVE_WITH_ARROWS_MODES },
    speed: { kind: "number", default: 2 },
  },
  code: ({ thing, settings, keyState }) => {
    if (settings.move === "turn") {
      moveWithTurn(thing, keyState, settings.speed);
      return;
    }
    moveSideways(thing, keyState, settings.speed);
  },
};

export default moveWithArrows;

function moveSideways(thing: RuntimeThing, keyState: KeyState, speed: number) {
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
}

function moveWithTurn(thing: RuntimeThing, keyState: KeyState, speed: number) {
  const left = keyState.arrowLeft || keyState.keyA;
  const right = keyState.arrowRight || keyState.keyD;
  const up = keyState.arrowUp || keyState.keyW;
  const down = keyState.arrowDown || keyState.keyS;

  const turnInput = Number(right) - Number(left);
  const moveInput = Number(up) - Number(down);

  if (turnInput !== 0) {
    thing.angle += turnInput * speed;
  }

  if (moveInput === 0) {
    thing.velocityX = 0;
    thing.velocityY = 0;
    return;
  }

  const radians = (thing.angle * Math.PI) / 180;
  const direction = { x: Math.sin(radians), y: -Math.cos(radians) };

  thing.velocityX = direction.x * speed * moveInput;
  thing.velocityY = direction.y * speed * moveInput;
}
