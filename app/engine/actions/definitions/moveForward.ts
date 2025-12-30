import { ActionDefinition } from "@/engine/types";

const allowedTriggers: ActionDefinition<"input" | "update">["allowedTriggers"] = [
  "input",
  "update",
];

const moveForward: ActionDefinition<
  "input" | "update",
  { speed: { kind: "number"; default: number } }
> = {
  allowedTriggers,
  settings: {
    speed: { kind: "number", default: 2 },
  },
  code: ({ thing, settings }) => {
    const radians = (thing.angle * Math.PI) / 180;
    const direction = { x: Math.sin(radians), y: -Math.cos(radians) };
    thing.velocityX = direction.x * settings.speed;
    thing.velocityY = direction.y * settings.speed;
  },
};

export default moveForward;
