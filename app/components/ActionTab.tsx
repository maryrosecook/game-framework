import { useEffect, useMemo, useRef } from "react";
import { actions } from "@/engine/actions";
import { createBehaviorForTrigger } from "@/engine/actions/behaviorActions";
import {
  ActionSettings,
  BehaviorAction,
  Blueprint,
  BlueprintBehaviors,
  COLLISION_TRIGGER_ANY,
  CollisionTriggerBlueprint,
  GameAction,
  INPUT_KEYS,
  InputKey,
  InputTriggerKey,
  InputTriggerStage,
  TriggerName,
  isCollisionTriggerBlueprint,
  isInputTriggerKey,
  isInputTriggerStage,
} from "@/engine/types";
import { getDefaultActionSettings } from "@/engine/actions/settings";
import { ActionCard, actionLabelFromKey } from "@/components/ActionCard";

const TRIGGERS: TriggerName[] = ["create", "input", "update", "collision"];

const TRIGGER_LABELS: Record<TriggerName, string> = {
  create: "Create",
  input: "Input",
  update: "Update",
  collision: "Collision",
};

const SELECT_CLASS =
  "select-chevron w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400 cursor-pointer";

const INPUT_SELECT_CLASS =
  "select-chevron rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400 cursor-pointer";

const INPUT_KEY_LABELS: Record<InputKey, string> = {
  arrowLeft: "Arrow Left",
  arrowRight: "Arrow Right",
  arrowUp: "Arrow Up",
  arrowDown: "Arrow Down",
  digit1: "1",
  digit0: "0",
  digit9: "9",
  space: "Space",
  shift: "Shift",
  keyW: "W",
  keyA: "A",
  keyS: "S",
  keyD: "D",
  keyE: "E",
};

const INPUT_KEY_OPTIONS: Array<{ value: InputTriggerKey; label: string }> = [
  { value: "any", label: "Any key" },
  ...INPUT_KEYS.map((key) => ({ value: key, label: INPUT_KEY_LABELS[key] })),
];

const INPUT_STAGE_OPTIONS: Array<{
  value: InputTriggerStage;
  label: string;
}> = [
  { value: "press", label: "Press" },
  { value: "hold", label: "Hold" },
];

const COLLISION_BLUEPRINT_LABEL = "Any";

type ActionTabProps = {
  blueprint: Blueprint;
  blueprints: Blueprint[];
  dispatch: (action: GameAction) => void;
};

export function ActionTab({ blueprint, blueprints, dispatch }: ActionTabProps) {
  const behaviors: BlueprintBehaviors = blueprint.behaviors ?? [];
  const triggerSections = behaviors;
  const { listRef, markPendingScroll } = useScrollToNewTrigger(
    blueprint.name,
    behaviors.length
  );
  const blueprintNames = useMemo(
    () =>
      [...blueprints]
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b)),
    [blueprints]
  );

  function handleAddActionTrigger() {
    const nextBehavior = createBehaviorForTrigger("update", []);
    const nextBehaviors: BlueprintBehaviors = [
      ...behaviors,
      nextBehavior,
    ];
    markPendingScroll(behaviors.length);
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleTriggerChange(index: number, trigger: TriggerName) {
    const target = behaviors[index];
    if (!target || target.trigger === trigger) {
      return;
    }
    const nextBehavior = createBehaviorForTrigger(trigger, target.actions);
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === index ? nextBehavior : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleRemoveTrigger(index: number) {
    if (!behaviors[index]) {
      return;
    }
    const nextBehaviors = behaviors.filter((_, idx) => idx !== index);
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleAddAction(index: number, actionKey: string) {
    const definition = actions[actionKey];
    if (!definition) {
      return;
    }
    const target = behaviors[index];
    if (!target) {
      return;
    }
    const existing = target.actions;
    const nextActions: BehaviorAction[] = [
      ...existing,
      {
        action: actionKey,
        settings: getDefaultActionSettings(definition.settings),
      },
    ];
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === index ? { ...behavior, actions: nextActions } : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleRemoveAction(behaviorIndex: number, actionIndex: number) {
    const target = behaviors[behaviorIndex];
    if (!target) {
      return;
    }
    const existing = target.actions;
    const nextActions = existing.filter((_, idx) => idx !== actionIndex);
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === behaviorIndex ? { ...behavior, actions: nextActions } : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleSettingChange(
    behaviorIndex: number,
    actionIndex: number,
    key: string,
    value: ActionSettings[string]
  ) {
    const existing = behaviors[behaviorIndex]?.actions ?? [];
    const target = existing[actionIndex];
    if (!target) {
      return;
    }
    const nextSettings = { ...target.settings, [key]: value };
    const nextActions = existing.map((action, idx) =>
      idx === actionIndex ? { ...action, settings: nextSettings } : action
    );
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === behaviorIndex ? { ...behavior, actions: nextActions } : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleInputKeyChange(index: number, key: InputTriggerKey) {
    const target = behaviors[index];
    if (!target) {
      return;
    }
    switch (target.trigger) {
      case "input": {
        const nextBehaviors = behaviors.map((behavior, idx) =>
          idx === index ? { ...behavior, key } : behavior
        );
        dispatch({
          type: "setBlueprintProperty",
          blueprintName: blueprint.name,
          property: "behaviors",
          value: nextBehaviors,
        });
        return;
      }
      case "create":
      case "update":
      case "collision":
        return;
    }
  }

  function handleInputStageChange(index: number, stage: InputTriggerStage) {
    const target = behaviors[index];
    if (!target) {
      return;
    }
    switch (target.trigger) {
      case "input": {
        const nextBehaviors = behaviors.map((behavior, idx) =>
          idx === index ? { ...behavior, stage } : behavior
        );
        dispatch({
          type: "setBlueprintProperty",
          blueprintName: blueprint.name,
          property: "behaviors",
          value: nextBehaviors,
        });
        return;
      }
      case "create":
      case "update":
      case "collision":
        return;
    }
  }

  function handleCollisionBlueprintChange(
    index: number,
    blueprintName: CollisionTriggerBlueprint
  ) {
    const target = behaviors[index];
    if (!target || target.trigger !== "collision") {
      return;
    }
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === index ? { ...behavior, blueprint: blueprintName } : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function renderTriggerInputs(
    behavior: BlueprintBehaviors[number],
    index: number
  ) {
    switch (behavior.trigger) {
      case "input":
        return (
          <>
            <select
              className={INPUT_SELECT_CLASS}
              value={behavior.key}
              aria-label="Input key"
              onChange={(event) => {
                const selected = event.target.value;
                if (isInputTriggerKey(selected)) {
                  handleInputKeyChange(index, selected);
                }
              }}
            >
              {INPUT_KEY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className={INPUT_SELECT_CLASS}
              value={behavior.stage}
              aria-label="Input stage"
              onChange={(event) => {
                const selected = event.target.value;
                if (isInputTriggerStage(selected)) {
                  handleInputStageChange(index, selected);
                }
              }}
            >
              {INPUT_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        );
      case "collision": {
        const options = getCollisionBlueprintOptions(
          blueprintNames,
          behavior.blueprint
        );
        return (
          <select
            className={INPUT_SELECT_CLASS}
            value={behavior.blueprint}
            aria-label="Collision blueprint"
            onChange={(event) => {
              const selected = event.target.value;
              if (isCollisionTriggerBlueprint(selected)) {
                handleCollisionBlueprintChange(index, selected);
              }
            }}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }
      case "create":
      case "update":
        return null;
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          onClick={handleAddActionTrigger}
        >
          Add Action
        </button>
      </div>

      <div
        className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-1"
        ref={listRef}
      >
        {triggerSections.map((behavior, index) => (
          <div
            key={`${behavior.trigger}-${index}`}
            data-trigger-index={index}
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3"
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
              <div className="flex items-center gap-2">
                <select
                  className={INPUT_SELECT_CLASS}
                  value={behavior.trigger}
                  aria-label="Trigger"
                  onChange={(event) => {
                    const selected = event.target.value;
                    if (isTriggerName(selected)) {
                      handleTriggerChange(index, selected);
                    }
                  }}
                >
                  {TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {TRIGGER_LABELS[trigger]}
                    </option>
                  ))}
                </select>
                {renderTriggerInputs(behavior, index)}
              </div>
              {behavior.actions.length === 0 ? (
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
                  onClick={() => handleRemoveTrigger(index)}
                  aria-label={`Remove ${TRIGGER_LABELS[behavior.trigger]} trigger`}
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="space-y-2">
              {behavior.actions.length === 0 ? (
                <p className="text-xs text-slate-500">No actions yet.</p>
              ) : (
                behavior.actions.map((behaviorAction, actionIndex) => (
                  <ActionCard
                    key={`${behaviorAction.action}-${actionIndex}`}
                    actionKey={behaviorAction.action}
                    behaviorAction={behaviorAction}
                    blueprintNames={blueprintNames}
                    blueprintColor={blueprint.color}
                    onRemove={() => handleRemoveAction(index, actionIndex)}
                    onSettingChange={(key, value) =>
                      handleSettingChange(index, actionIndex, key, value)
                    }
                  />
                ))
              )}
            </div>

            <select
              className={SELECT_CLASS}
              defaultValue=""
              onChange={(event) => {
                const selected = event.target.value;
                if (selected) {
                  handleAddAction(index, selected);
                }
                event.currentTarget.value = "";
              }}
            >
              <option value="" disabled>
                Then…
              </option>
              {getActionOptions(behavior.trigger).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function getActionOptions(trigger: TriggerName) {
  return Object.keys(actions)
    .filter((key) => actions[key].allowedTriggers.includes(trigger))
    .map((key) => ({ value: key, label: actionLabelFromKey(key) }));
}

function getCollisionBlueprintOptions(
  blueprintNames: string[],
  selected: CollisionTriggerBlueprint
) {
  const options: Array<{ value: CollisionTriggerBlueprint; label: string }> = [
    { value: COLLISION_TRIGGER_ANY, label: COLLISION_BLUEPRINT_LABEL },
  ];
  if (
    selected !== COLLISION_TRIGGER_ANY &&
    !blueprintNames.includes(selected)
  ) {
    options.push({
      value: selected,
      label: `${selected} (missing)`,
    });
  }
  for (const name of blueprintNames) {
    options.push({ value: name, label: name });
  }
  return options;
}

function isTriggerName(value: string): value is TriggerName {
  return TRIGGERS.some((trigger) => trigger === value);
}

function useScrollToNewTrigger(blueprintName: string, behaviorCount: number) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollIndexRef = useRef<number | null>(null);
  const previousBehaviorCountRef = useRef<number>(behaviorCount);
  const previousBlueprintRef = useRef<string>(blueprintName);

  useEffect(() => {
    if (previousBlueprintRef.current !== blueprintName) {
      previousBlueprintRef.current = blueprintName;
      previousBehaviorCountRef.current = behaviorCount;
      pendingScrollIndexRef.current = null;
      return;
    }
    const previousCount = previousBehaviorCountRef.current;
    if (behaviorCount > previousCount) {
      const targetIndex =
        pendingScrollIndexRef.current ?? behaviorCount - 1;
      const container = listRef.current;
      if (container) {
        const selector = `[data-trigger-index="${targetIndex}"]`;
        const target = container.querySelector(selector);
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }
    previousBehaviorCountRef.current = behaviorCount;
    pendingScrollIndexRef.current = null;
  }, [behaviorCount, blueprintName]);

  const markPendingScroll = (index: number) => {
    pendingScrollIndexRef.current = index;
  };

  return { listRef, markPendingScroll };
}
