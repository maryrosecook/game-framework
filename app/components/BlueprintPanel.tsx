import { Blueprint } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { GameEngine } from "@/engine/engine";
import { ColorGrid } from "@/components/ColorGrid";
import { SelectField } from "@/components/SelectField";
import { normalizeName } from "@/engine/reducer";

export function BlueprintPanel({
  blueprintName,
  subscribe,
  engine,
  onRename,
}: {
  blueprintName: string;
  subscribe: GameSubscribe;
  engine: GameEngine;
  onRename: (next: string) => void;
}) {
  const [blueprint, dispatchBlueprint] = subscribe<Blueprint | undefined>([
    "blueprints",
    blueprintName,
  ]);
  const [isPaused] = subscribe<boolean>(["isPaused"]);

  if (!blueprint) {
    return null;
  }

  const updateField = (property: keyof Blueprint, value: string | number) => {
    if (!isPaused) return;
    dispatchBlueprint({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property,
      value,
    });
  };

  const handleRename = (value: string) => {
    if (!isPaused) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === blueprint.name) {
      return;
    }
    const previousName = blueprint.name;
    engine.dispatch({
      type: "renameBlueprint",
      previousName,
      nextName: trimmed,
    });
    onRename(trimmed);
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Blueprint
        </p>
        <input
          key={blueprint.name}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
          defaultValue={blueprint.name}
          onBlur={(event) => {
            handleRename(event.target.value);
          }}
          disabled={!isPaused}
        />
      </header>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="W"
            value={blueprint.width}
            onChange={(value) => updateField("width", value)}
            disabled={!isPaused}
          />
          <Field
            label="H"
            value={blueprint.height}
            onChange={(value) => updateField("height", value)}
            disabled={!isPaused}
          />
        </div>
        <SelectField
          label="Shape"
          value={blueprint.shape}
          options={[
            { label: "Rectangle", value: "rectangle" },
            { label: "Triangle", value: "triangle" },
          ]}
          onChange={(value) => updateField("shape", value)}
          disabled={!isPaused}
        />
        <SelectField
          label="Physics"
          value={blueprint.physicsType}
          options={[
            { label: "Dynamic", value: "dynamic" },
            { label: "Static", value: "static" },
          ]}
          onChange={(value) => updateField("physicsType", value)}
          disabled={!isPaused}
        />
        <Field
          label="Z"
          value={blueprint.z}
          onChange={(value) => updateField("z", value)}
          disabled={!isPaused}
        />
        <ColorGrid
          selected={blueprint.color}
          onSelect={(color) => updateField("color", color)}
          disabled={!isPaused}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
      {label}
      <input
        type="number"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}
