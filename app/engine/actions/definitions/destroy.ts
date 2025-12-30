import { ActionDefinition, TriggerName } from "@/engine/types";

const allowedTriggers: ActionDefinition["allowedTriggers"] = [
  "create",
  "input",
  "update",
  "collision",
];

const destroy: ActionDefinition<TriggerName, {}> = {
  allowedTriggers,
  settings: {},
  code: ({ thing, game }) => {
    game.destroy(thing);
  },
};

export default destroy;
