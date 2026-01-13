import {
  ActionDefinition,
  ActionSettingEnum,
  ActionSettingSpawnInit,
  Blueprint,
  RawThing,
  Shape,
  SpawnInitAssignments,
  TriggerName,
  RuntimeThing,
  Vector,
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
    const targetBlueprint = game.gameState.blueprints.find(
      (blueprint) => blueprint.name === blueprintName
    );
    if (!targetBlueprint) {
      console.warn(`Spawn blueprint "${blueprintName}" not found.`);
      return;
    }
    const overrides = buildSpawnOverrides(settings.initialVars, thing);
    const spawnerBlueprint = game.gameState.blueprints.find(
      (blueprint) => blueprint.name === thing.blueprintName
    );
    if (!spawnerBlueprint) {
      throw new Error(`Spawner blueprint "${thing.blueprintName}" not found.`);
    }
    const spawnerShape = spawnerBlueprint.shape ?? "rectangle";
    const position = getSpawnPosition(
      thing,
      spawnerShape,
      targetBlueprint,
      overrides
    );
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

function getSpawnPosition(
  spawner: RuntimeThing,
  spawnerShape: Shape,
  spawnBlueprint: Blueprint,
  overrides: Partial<RawThing>
): Vector {
  const center = {
    x: spawner.x + spawner.width / 2,
    y: spawner.y + spawner.height / 2,
  };
  const direction = directionFromAngle(spawner.angle);
  const spawnerExtent = maxExtentForShape(
    spawnerShape,
    spawner.width,
    spawner.height
  );
  const spawnDimensions = getSpawnDimensions(spawnBlueprint, overrides);
  const spawnExtent = maxExtentForShape(
    spawnDimensions.shape,
    spawnDimensions.width,
    spawnDimensions.height
  );
  const distance = spawnerExtent + spawnExtent;
  return {
    x: center.x + direction.x * distance,
    y: center.y + direction.y * distance,
  };
}

function getSpawnDimensions(
  spawnBlueprint: Blueprint,
  overrides: Partial<RawThing>
): { shape: Shape; width: number; height: number } {
  return {
    shape: spawnBlueprint.shape ?? "rectangle",
    width: overrides.width ?? spawnBlueprint.width,
    height: overrides.height ?? spawnBlueprint.height,
  };
}

function directionFromAngle(angle: number): Vector {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function maxExtentForShape(
  shape: Shape,
  width: number,
  height: number
): number {
  if (shape === "circle") {
    return width / 2;
  }
  return Math.hypot(width / 2, height / 2);
}

export default spawnObject;
