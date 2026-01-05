import {
  BehaviorAction,
  BlueprintBehavior,
  BlueprintBehaviors,
  InputTriggerKey,
  InputTriggerStage,
  TriggerName,
} from "@/engine/types";

const DEFAULT_INPUT_TRIGGER_KEY: InputTriggerKey = "any";
const DEFAULT_INPUT_TRIGGER_STAGE: InputTriggerStage = "press";

export function createBehaviorForTrigger(
  trigger: TriggerName,
  actions: BehaviorAction[]
): BlueprintBehavior {
  if (trigger === "input") {
    return {
      trigger,
      key: DEFAULT_INPUT_TRIGGER_KEY,
      stage: DEFAULT_INPUT_TRIGGER_STAGE,
      actions,
    };
  }
  return { trigger, actions };
}

export function renameSpawnObjectBlueprints(
  behaviors: BlueprintBehaviors | undefined,
  previousName: string,
  nextName: string
): BlueprintBehaviors | undefined {
  if (!behaviors || previousName === nextName) {
    return behaviors;
  }
  let changed = false;
  const nextBehaviors: BlueprintBehaviors = behaviors.map((behavior) => {
    let entryChanged = false;
    const nextActions = behavior.actions.map((action) => {
      if (action.action !== "spawnObject") {
        return action;
      }
      const blueprint = action.settings.blueprint;
      if (typeof blueprint !== "string" || blueprint !== previousName) {
        return action;
      }
      entryChanged = true;
      return {
        ...action,
        settings: { ...action.settings, blueprint: nextName },
      };
    });
    if (!entryChanged) {
      return behavior;
    }
    changed = true;
    return { ...behavior, actions: nextActions };
  });
  return changed ? nextBehaviors : behaviors;
}
