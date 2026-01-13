import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { actions } from "@/engine/actions";
import { resolveActionSettings } from "@/engine/actions/settings";
import { ActionSettings, BehaviorAction } from "@/engine/types";
import { ActionSettingField } from "@/components/ActionSettingField";

type ActionCardProps = {
  actionKey: string;
  behaviorAction: BehaviorAction;
  blueprintNames: string[];
  blueprintColor: string;
  onRemove: () => void;
  onSettingChange: (key: string, value: ActionSettings[string]) => void;
};

export function ActionCard({
  actionKey,
  behaviorAction,
  blueprintNames,
  blueprintColor,
  onRemove,
  onSettingChange,
}: ActionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const definition = actions[actionKey];
  const label = actionLabelFromKey(actionKey);
  const resolvedSettings = definition
    ? resolveActionSettings(definition.settings, behaviorAction.settings)
    : {};

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
      <button
        type="button"
        className="-mx-3 -mt-3 flex w-[calc(100%+1.5rem)] items-center justify-between px-3 pt-3 text-left text-sm font-semibold text-slate-700 cursor-pointer"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={`${isOpen ? "Collapse" : "Expand"} ${label} action`}
      >
        <span>{label}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
        )}
      </button>
      {isOpen ? (
        <>
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
                  blueprintColor={blueprintColor}
                  onChange={(value) => onSettingChange(key, value)}
                />
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              className="text-xs text-red-600 hover:text-red-700"
              onClick={onRemove}
            >
              Delete
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function actionLabelFromKey(key: string) {
  switch (key) {
    case "ai":
      return "AI Action";
    default:
      return humanizeKey(key);
  }
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
