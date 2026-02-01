import {
  BehaviorAction,
  BlueprintBehavior,
  BlueprintBehaviors,
  COLLISION_TRIGGER_ANY,
  InputTriggerKey,
  InputTriggerStage,
  TriggerName,
} from "@/engine/types";

const DEFAULT_INPUT_TRIGGER_KEY: InputTriggerKey = "any";
const DEFAULT_INPUT_TRIGGER_STAGE: InputTriggerStage = "press";
const DEFAULT_COLLISION_TRIGGER_BLUEPRINT = COLLISION_TRIGGER_ANY;

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
  if (trigger === "collision") {
    return {
      trigger,
      blueprint: DEFAULT_COLLISION_TRIGGER_BLUEPRINT,
      actions,
    };
  }
  return { trigger, actions };
}

export function renameBehaviorBlueprints(
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
    let nextBehavior: BlueprintBehavior = behavior;
    if (
      behavior.trigger === "collision" &&
      behavior.blueprint === previousName
    ) {
      entryChanged = true;
      nextBehavior = { ...behavior, blueprint: nextName };
    }
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
    return { ...nextBehavior, actions: nextActions };
  });
  return changed ? nextBehaviors : behaviors;
}
