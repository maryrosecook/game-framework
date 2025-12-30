import { ActionDefinition, TriggerName } from "@/engine/types";

const allowedTriggers: ActionDefinition["allowedTriggers"] = [
  "create",
  "input",
  "update",
  "collision",
];

const spawnObject: ActionDefinition<
  TriggerName,
  { blueprint: { kind: "enum"; default: string; options: string[] } }
> = {
  allowedTriggers,
  settings: {
    blueprint: { kind: "enum", default: "", options: [] },
  },
  code: ({ thing, game, settings }) => {
    const blueprintName = settings.blueprint.trim();
    if (!blueprintName) {
      return;
    }
    const exists = game.gameState.blueprints.some(
      (blueprint) => blueprint.name === blueprintName
    );
    if (!exists) {
      console.warn(`Spawn blueprint "${blueprintName}" not found.`);
      return;
    }
    const position = {
      x: thing.x + thing.width / 2,
      y: thing.y + thing.height / 2,
    };
    const spawned = game.spawn({ blueprint: blueprintName, position });
    if (!spawned) {
      console.warn(`Spawn failed for blueprint "${blueprintName}".`);
    }
  },
};

export default spawnObject;
