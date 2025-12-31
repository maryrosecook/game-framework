import {
  ActionSetting,
  ActionSettingValue,
  ActionSettings,
  isSpawnInitAssignments,
} from "@/engine/types";

function isValidSettingValue(
  definition: ActionSetting,
  value: ActionSettingValue
): boolean {
  switch (definition.kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      if (typeof value !== "string") {
        return false;
      }
      if (definition.options.length === 0) {
        return true;
      }
      return definition.options.includes(value);
    case "spawnInit":
      return isSpawnInitAssignments(value);
    default: {
      const _exhaustiveCheck: never = definition;
      return _exhaustiveCheck;
    }
  }
}

function getDefaultSettingValue(definition: ActionSetting): ActionSettingValue {
  if (definition.kind !== "spawnInit") {
    return definition.default;
  }
  return definition.default.map((assignment) => ({
    property: assignment.property,
    value: {
      type: assignment.value.type,
      literal: assignment.value.literal ?? 0,
    },
  }));
}

export function getDefaultActionSettings<
  TSettings extends Record<string, ActionSetting>
>(definitions: TSettings): ActionSettings {
  const defaults: ActionSettings = {};
  for (const key of Object.keys(definitions)) {
    defaults[key] = getDefaultSettingValue(definitions[key]);
  }
  return defaults;
}

export function resolveActionSettings<
  TSettings extends Record<string, ActionSetting>
>(definitions: TSettings, stored: ActionSettings | undefined): ActionSettings {
  const resolved: ActionSettings = {};
  for (const key of Object.keys(definitions)) {
    const definition = definitions[key];
    const candidate = stored?.[key];
    if (candidate !== undefined && isValidSettingValue(definition, candidate)) {
      resolved[key] = candidate;
    } else {
      resolved[key] = getDefaultSettingValue(definition);
    }
  }
  return resolved;
}
