import { BlueprintBehaviors, TriggerName } from "@/engine/types";

const TRIGGERS: TriggerName[] = ["create", "input", "update", "collision"];

export function renameSpawnObjectBlueprints(
  behaviors: BlueprintBehaviors | undefined,
  previousName: string,
  nextName: string
): BlueprintBehaviors | undefined {
  if (!behaviors || previousName === nextName) {
    return behaviors;
  }
  let changed = false;
  const nextBehaviors: BlueprintBehaviors = { ...behaviors };
  for (const trigger of TRIGGERS) {
    const actions = behaviors[trigger];
    if (!actions) {
      continue;
    }
    let triggerChanged = false;
    const nextActions = actions.map((action) => {
      if (action.action !== "spawnObject") {
        return action;
      }
      const blueprint = action.settings.blueprint;
      if (typeof blueprint !== "string" || blueprint !== previousName) {
        return action;
      }
      triggerChanged = true;
      changed = true;
      return {
        ...action,
        settings: { ...action.settings, blueprint: nextName },
      };
    });
    if (triggerChanged) {
      nextBehaviors[trigger] = nextActions;
    }
  }
  return changed ? nextBehaviors : behaviors;
}
