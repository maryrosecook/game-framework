import { useEffect, useMemo, useRef } from "react";
import { actions } from "@/engine/actions";
import { createBehaviorForTrigger } from "@/engine/actions/behaviorActions";
import {
  ActionSetting,
  ActionSettingEnum,
  ActionSettings,
  BehaviorAction,
  Blueprint,
  BlueprintBehaviors,
  GameAction,
  INPUT_KEYS,
  InputKey,
  InputTriggerKey,
  InputTriggerStage,
  SPAWN_INIT_PROPERTIES,
  SpawnInitAssignment,
  SpawnInitAssignments,
  SpawnInitProperty,
  SpawnInitValue,
  TriggerName,
  isInputTriggerKey,
  isSpawnInitAssignments,
  isSpawnInitProperty,
  isInputTriggerStage,
} from "@/engine/types";
import {
  getDefaultActionSettings,
  resolveActionSettings,
} from "@/engine/actions/settings";

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

const INLINE_INPUT_CLASS =
  "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400";

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

const SPAWN_INIT_PROPERTY_OPTIONS = SPAWN_INIT_PROPERTIES.map((property) => ({
  value: property,
  label: humanizeKey(property),
}));

const SPAWN_INIT_VALUE_TYPE_OPTIONS: Array<{
  value: SpawnInitValue["type"];
  label: string;
}> = [
  { value: "literal", label: "Number" },
  { value: "source", label: "Source" },
];

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
    const definition = actions.ai;
    if (!definition) {
      throw new Error("AI action definition missing from registry.");
    }
    const aiAction: BehaviorAction = {
      action: "ai",
      settings: getDefaultActionSettings(definition.settings),
    };
    const nextBehavior = createBehaviorForTrigger("update", [aiAction]);
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
    if (!target || target.trigger !== "input") {
      return;
    }
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === index ? { ...behavior, key } : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
  }

  function handleInputStageChange(index: number, stage: InputTriggerStage) {
    const target = behaviors[index];
    if (!target || target.trigger !== "input") {
      return;
    }
    const nextBehaviors = behaviors.map((behavior, idx) =>
      idx === index ? { ...behavior, stage } : behavior
    );
    dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "behaviors",
      value: nextBehaviors,
    });
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
                {behavior.trigger === "input" ? (
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
                ) : null}
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

function ActionCard({
  actionKey,
  behaviorAction,
  blueprintNames,
  onRemove,
  onSettingChange,
}: {
  actionKey: string;
  behaviorAction: BehaviorAction;
  blueprintNames: string[];
  onRemove: () => void;
  onSettingChange: (key: string, value: ActionSettings[string]) => void;
}) {
  const definition = actions[actionKey];
  const label = actionLabelFromKey(actionKey);
  const resolvedSettings = definition
    ? resolveActionSettings(definition.settings, behaviorAction.settings)
    : {};

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          onClick={onRemove}
          aria-label={`Remove ${label} action`}
        >
          ×
        </button>
      </div>
      {!definition ? (
        <p className="text-xs text-amber-600">Action definition missing.</p>
      ) : Object.keys(definition.settings).length === 0 ? (
        <p className="text-xs text-slate-500">No settings.</p>
      ) : (
        <div className="space-y-2">
          {Object.keys(definition.settings).map((key) => (
            <ActionSettingField
              key={key}
              actionKey={actionKey}
              settingKey={key}
              setting={definition.settings[key]}
              resolvedSettings={resolvedSettings}
              blueprintNames={blueprintNames}
              onChange={(value) => onSettingChange(key, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionSettingField({
  actionKey,
  settingKey,
  setting,
  resolvedSettings,
  blueprintNames,
  onChange,
}: {
  actionKey: string;
  settingKey: string;
  setting: ActionSetting;
  resolvedSettings: ActionSettings;
  blueprintNames: string[];
  onChange: (value: ActionSettings[string]) => void;
}) {
  const currentValue = resolvedSettings[settingKey];

  if (setting.kind === "boolean") {
    const checked = typeof currentValue === "boolean" ? currentValue : false;
    return (
      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 accent-slate-900"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        {humanizeKey(settingKey)}
      </label>
    );
  }

  if (setting.kind === "number") {
    const value = typeof currentValue === "number" ? currentValue : 0;
    return (
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
        {humanizeKey(settingKey)}
        <input
          type="number"
          className={`w-full ${INLINE_INPUT_CLASS}`}
          value={value}
          min={setting.min}
          max={setting.max}
          step={setting.step}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            if (!Number.isFinite(nextValue)) {
              return;
            }
            onChange(nextValue);
          }}
        />
      </label>
    );
  }

  if (setting.kind === "string") {
    const value = typeof currentValue === "string" ? currentValue : "";
    return (
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
        {humanizeKey(settingKey)}
        {setting.isSingleLine ? (
          <input
            type="text"
            className={`w-full ${INLINE_INPUT_CLASS}`}
            value={value}
            maxLength={setting.maxLength}
            placeholder={setting.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <textarea
            className={`w-full ${INLINE_INPUT_CLASS} min-h-[96px] resize-y`}
            value={value}
            maxLength={setting.maxLength}
            placeholder={setting.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </label>
    );
  }

  if (setting.kind === "enum") {
    const value = typeof currentValue === "string" ? currentValue : "";
    const options = getEnumOptions(
      actionKey,
      settingKey,
      setting,
      blueprintNames,
      value
    );
    const isMissingBlueprint =
      actionKey === "spawnObject" &&
      settingKey === "blueprint" &&
      value.length > 0 &&
      !blueprintNames.includes(value);

    return (
      <div className="space-y-1">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
          {humanizeKey(settingKey)}
          <select
            className={SELECT_CLASS}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {isMissingBlueprint ? (
          <p className="text-xs text-amber-600">
            Saved blueprint no longer exists.
          </p>
        ) : null}
      </div>
    );
  }

  if (setting.kind === "spawnInit") {
    const value = isSpawnInitAssignments(currentValue)
      ? currentValue
      : setting.default;
    return (
      <SpawnInitSettingField
        assignments={value}
        onChange={onChange}
      />
    );
  }

  return null;
}

function SpawnInitSettingField({
  assignments,
  onChange,
}: {
  assignments: SpawnInitAssignments;
  onChange: (value: SpawnInitAssignments) => void;
}) {
  const handleAdd = () => {
    const defaultProperty: SpawnInitProperty = "angle";
    const nextAssignment: SpawnInitAssignment = {
      property: defaultProperty,
      value: { type: "source", literal: 0 },
    };
    onChange([...assignments, nextAssignment]);
  };

  const handleRemove = (index: number) => {
    onChange(assignments.filter((_, idx) => idx !== index));
  };

  const handlePropertyChange = (index: number, property: SpawnInitProperty) => {
    onChange(
      assignments.map((assignment, idx) =>
        idx === index ? { ...assignment, property } : assignment
      )
    );
  };

  const handleValueTypeChange = (
    index: number,
    valueType: SpawnInitValue["type"]
  ) => {
    onChange(
      assignments.map((assignment, idx) => {
        if (idx !== index) {
          return assignment;
        }
        return {
          ...assignment,
          value: {
            type: valueType,
            literal: assignment.value.literal ?? 0,
          },
        };
      })
    );
  };

  const handleLiteralValueChange = (index: number, value: number) => {
    onChange(
      assignments.map((assignment, idx) => {
        if (idx !== index || assignment.value.type !== "literal") {
          return assignment;
        }
        return {
          ...assignment,
          value: { type: "literal", literal: value },
        };
      })
    );
  };

  return (
    <div className="space-y-2">
      {assignments.length === 0 ? (
        <p className="text-xs text-slate-500">No vars yet.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment, index) => (
            <div
              key={`${assignment.property}-${index}`}
              className="flex items-center gap-2"
            >
              <select
                className={`${INPUT_SELECT_CLASS} flex-1 basis-0 min-w-0`}
                value={assignment.property}
                aria-label="Spawn property"
                onChange={(event) => {
                  const selected = event.target.value;
                  if (isSpawnInitProperty(selected)) {
                    handlePropertyChange(index, selected);
                  }
                }}
              >
                {SPAWN_INIT_PROPERTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                className={`${INPUT_SELECT_CLASS} flex-1 basis-0 min-w-0`}
                value={assignment.value.type}
                aria-label="Spawn value type"
                onChange={(event) => {
                  const selected = event.target.value;
                  if (isSpawnInitValueType(selected)) {
                    handleValueTypeChange(index, selected);
                  }
                }}
              >
                {SPAWN_INIT_VALUE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {assignment.value.type === "literal" ? (
                <input
                  type="number"
                  className={`${INLINE_INPUT_CLASS} flex-1 basis-0 min-w-0`}
                  value={assignment.value.literal ?? 0}
                  aria-label="Spawn number value"
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    if (!Number.isFinite(nextValue)) {
                      return;
                    }
                    handleLiteralValueChange(index, nextValue);
                  }}
                />
              ) : null}
              <button
                type="button"
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
                aria-label="Remove spawn init"
                onClick={() => handleRemove(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="text-xs font-medium text-slate-600 hover:text-slate-900"
        onClick={handleAdd}
      >
        + Add var
      </button>
    </div>
  );
}

function getEnumOptions(
  actionKey: string,
  settingKey: string,
  setting: ActionSettingEnum,
  blueprintNames: string[],
  currentValue: string
) {
  if (actionKey === "spawnObject" && settingKey === "blueprint") {
    const options: { label: string; value: string }[] = [
      { label: "Select blueprint", value: "" },
    ];
    if (currentValue && !blueprintNames.includes(currentValue)) {
      options.push({
        label: `${currentValue} (missing)`,
        value: currentValue,
      });
    }
    for (const name of blueprintNames) {
      options.push({ label: name, value: name });
    }
    return options;
  }

  return setting.options.map((option) => ({ label: option, value: option }));
}

function getActionOptions(trigger: TriggerName) {
  return Object.keys(actions)
    .filter((key) => actions[key].allowedTriggers.includes(trigger))
    .map((key) => ({ value: key, label: actionLabelFromKey(key) }));
}

function actionLabelFromKey(key: string) {
  if (key === "ai") {
    return "AI Action";
  }
  return humanizeKey(key);
}

function sentenceCase(value: string) {
  if (value.length === 0) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
}

function humanizeKey(value: string) {
  const withSpaces = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return sentenceCase(withSpaces);
}

function isSpawnInitValueType(value: string): value is SpawnInitValue["type"] {
  return SPAWN_INIT_VALUE_TYPE_OPTIONS.some((option) => option.value === value);
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
