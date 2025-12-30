import { ActionDefinition } from "@/engine/types";

const allowedTriggers: ActionDefinition<"input" | "update">["allowedTriggers"] = [
  "input",
  "update",
];

const turn: ActionDefinition<
  "input" | "update",
  {
    direction: { kind: "enum"; default: string; options: string[] };
    speed: { kind: "number"; default: number };
  }
> = {
  allowedTriggers,
  settings: {
    direction: { kind: "enum", default: "right", options: ["left", "right"] },
    speed: { kind: "number", default: 2 },
  },
  code: ({ thing, settings }) => {
    const multiplier = settings.direction === "left" ? -1 : 1;
    thing.angle += multiplier * settings.speed;
  },
};

export default turn;
