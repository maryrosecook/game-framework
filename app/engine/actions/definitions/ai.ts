import { ActionDefinition, TriggerName } from "@/engine/types";

const allowedTriggers: ActionDefinition<TriggerName>["allowedTriggers"] = [
  "create",
  "input",
  "update",
  "collision",
];

const ai: ActionDefinition<
  TriggerName,
  { prompt: { kind: "string"; default: string; isSingleLine: boolean } }
> = {
  allowedTriggers,
  settings: {
    prompt: { kind: "string", default: "", isSingleLine: false },
  },
  code: () => {},
};

export default ai;
