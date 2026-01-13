import { ColorSelect, ColorSelectOption } from "@/components/ColorSelect";
import { getColorOptions } from "@/lib/colors";
import {
  ActionSetting,
  ActionSettingEnum,
  ActionSettings,
  SPAWN_INIT_PROPERTIES,
  SpawnInitAssignment,
  SpawnInitAssignments,
  SpawnInitProperty,
  SpawnInitValue,
  isSpawnInitAssignments,
  isSpawnInitProperty,
} from "@/engine/types";

const SELECT_CLASS =
  "select-chevron w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400 cursor-pointer";

const INPUT_SELECT_CLASS =
  "select-chevron rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400 cursor-pointer";

const INLINE_INPUT_CLASS =
  "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400";

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

type ActionSettingFieldProps = {
  actionKey: string;
  settingKey: string;
  setting: ActionSetting;
  resolvedSettings: ActionSettings;
  blueprintNames: string[];
  blueprintColor: string;
  onChange: (value: ActionSettings[string]) => void;
};

export function ActionSettingField({
  actionKey,
  settingKey,
  setting,
  resolvedSettings,
  blueprintNames,
  blueprintColor,
  onChange,
}: ActionSettingFieldProps) {
  const currentValue = resolvedSettings[settingKey];

  switch (setting.kind) {
    case "boolean": {
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
    case "number": {
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
    case "string": {
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
    case "enum": {
      const value = typeof currentValue === "string" ? currentValue : "";
      const override = renderEnumOverride(
        actionKey,
        settingKey,
        value,
        blueprintColor,
        onChange
      );
      if (override) {
        return override;
      }
      const options = getEnumOptions(
        actionKey,
        settingKey,
        setting,
        blueprintNames,
        value
      );
      const isMissingBlueprint = isMissingBlueprintSelection(
        actionKey,
        settingKey,
        value,
        blueprintNames
      );

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
    case "spawnInit": {
      const value = isSpawnInitAssignments(currentValue)
        ? currentValue
        : setting.default;
      return <SpawnInitSettingField assignments={value} onChange={onChange} />;
    }
  }

  return null;
}

function renderEnumOverride(
  actionKey: string,
  settingKey: string,
  value: string,
  blueprintColor: string,
  onChange: (value: ActionSettings[string]) => void
) {
  switch (actionKey) {
    case "explode": {
      switch (settingKey) {
        case "color": {
          const options = getExplodeColorOptions(blueprintColor);
          const selected = value || options[0]?.value || "";
          return (
            <ColorSelect
              label={humanizeKey(settingKey)}
              value={selected}
              options={options}
              onChange={onChange}
            />
          );
        }
        default:
          return null;
      }
    }
    default:
      return null;
  }
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
        if (idx !== index) {
          return assignment;
        }
        switch (assignment.value.type) {
          case "literal":
            return {
              ...assignment,
              value: { type: "literal", literal: value },
            };
          case "source":
            return assignment;
        }
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
              {renderLiteralValueField(assignment, index, handleLiteralValueChange)}
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

function renderLiteralValueField(
  assignment: SpawnInitAssignment,
  index: number,
  onChange: (index: number, value: number) => void
) {
  switch (assignment.value.type) {
    case "literal":
      return (
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
            onChange(index, nextValue);
          }}
        />
      );
    case "source":
      return null;
  }
}

function getEnumOptions(
  actionKey: string,
  settingKey: string,
  setting: ActionSettingEnum,
  blueprintNames: string[],
  currentValue: string
) {
  switch (actionKey) {
    case "spawnObject": {
      switch (settingKey) {
        case "blueprint": {
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
        default:
          return setting.options.map((option) => ({
            label: option,
            value: option,
          }));
      }
    }
    default:
      return setting.options.map((option) => ({
        label: option,
        value: option,
      }));
  }
}

function isMissingBlueprintSelection(
  actionKey: string,
  settingKey: string,
  value: string,
  blueprintNames: string[]
) {
  switch (actionKey) {
    case "spawnObject": {
      switch (settingKey) {
        case "blueprint":
          return value.length > 0 && !blueprintNames.includes(value);
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

function getExplodeColorOptions(blueprintColor: string): ColorSelectOption[] {
  const resolvedBlueprintColor = blueprintColor || "#888888";
  const options: ColorSelectOption[] = [
    {
      value: "blueprint",
      label: "Blueprint",
      swatch: resolvedBlueprintColor,
    },
  ];
  for (const color of getColorOptions()) {
    options.push({ value: color, label: color, swatch: color });
  }
  return options;
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
