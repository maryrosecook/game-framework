import {
  ActionDefinition,
  ActionSettingEnum,
  ActionSettingSpawnInit,
  RawThing,
  SpawnInitAssignments,
  TriggerName,
  RuntimeThing,
} from "@/engine/types";

const allowedTriggers: ActionDefinition["allowedTriggers"] = [
  "create",
  "input",
  "update",
  "collision",
];

const spawnObject: ActionDefinition<
  TriggerName,
  { blueprint: ActionSettingEnum; initialVars: ActionSettingSpawnInit }
> = {
  allowedTriggers,
  settings: {
    blueprint: { kind: "enum", default: "", options: [] },
    initialVars: { kind: "spawnInit", default: [] },
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
    const overrides = buildSpawnOverrides(settings.initialVars, thing);
    const spawned = game.spawn({
      blueprint: blueprintName,
      position,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    });
    if (!spawned) {
      console.warn(`Spawn failed for blueprint "${blueprintName}".`);
    }
  },
};

function buildSpawnOverrides(
  assignments: SpawnInitAssignments,
  source: RuntimeThing
): Partial<RawThing> {
    const overrides: Partial<RawThing> = {};
  for (const assignment of assignments) {
    const value =
      assignment.value.type === "literal"
        ? assignment.value.literal ?? 0
        : source[assignment.property];
    overrides[assignment.property] = value;
  }
  return overrides;
}

export default spawnObject;
