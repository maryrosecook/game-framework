"use client";

import { Blueprint } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { Pause, Play, Plus } from "lucide-react";

const BLUEPRINT_MIME = "application/x-blueprint";

type ToolbarProps = {
  blueprints: Blueprint[];
  selectedBlueprintName: string | null;
  onSelectBlueprint: (name: string) => void;
  onAddBlueprint: () => void;
  onTogglePause: () => void;
  isPaused: boolean;
};

export function Toolbar({
  blueprints,
  selectedBlueprintName,
  onSelectBlueprint,
  onAddBlueprint,
  onTogglePause,
  isPaused,
}: ToolbarProps) {
  return (
    <div className="inline-flex max-w-[800px] min-w-fit items-center gap-3 rounded-t-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-lg">
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label={isPaused ? "Play" : "Pause"}
        onClick={onTogglePause}
        className="rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
      >
        {isPaused ? <Play className="size-5" /> : <Pause className="size-5" />}
      </Button>
      <div className="flex flex-1 gap-2 overflow-x-auto py-1">
        {blueprints.map((blueprint) => (
          <BlueprintChip
            key={blueprint.name}
            blueprint={blueprint}
            selected={
              normalizeBlueprint(blueprint.name) ===
              normalizeBlueprint(selectedBlueprintName ?? "")
            }
            onSelect={() => onSelectBlueprint(blueprint.name)}
            isPaused={isPaused}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={isPaused ? onAddBlueprint : undefined}
        disabled={!isPaused}
        aria-label="Add blueprint"
        className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function BlueprintChip({
  blueprint,
  selected,
  onSelect,
  isPaused,
}: {
  blueprint: Blueprint;
  selected: boolean;
  onSelect: () => void;
  isPaused: boolean;
}) {
  return (
    <button
      type="button"
      draggable={isPaused}
      onDragStart={(event) => {
        if (!isPaused) return;
        event.dataTransfer.setData(BLUEPRINT_MIME, blueprint.name);
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", blueprint.name);
      }}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
        selected
          ? "border-slate-400 bg-slate-100 text-slate-900"
          : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200"
      }`}
    >
      <span
        className="size-3 rounded-full shadow-inner"
        style={{ backgroundColor: blueprint.color }}
      />
      {blueprint.name}
    </button>
  );
}

function normalizeBlueprint(value: string) {
  return value.trim().toLowerCase();
}
