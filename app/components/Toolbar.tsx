"use client";

import { Blueprint } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getBlueprintImageUrl } from "@/lib/images";

const BLUEPRINT_MIME = "application/x-blueprint";

type ToolbarProps = {
  blueprints: Blueprint[];
  selectedBlueprintName: string | null;
  onSelectBlueprint: (name: string) => void;
  onAddBlueprint: () => void;
  gameDirectory: string;
};

export function Toolbar({
  blueprints,
  selectedBlueprintName,
  onSelectBlueprint,
  onAddBlueprint,
  gameDirectory,
}: ToolbarProps) {
  return (
    <div className="inline-flex max-w-[800px] min-w-fit items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-lg">
      <div className="flex flex-1 gap-2 overflow-x-auto py-1">
        {blueprints.map((blueprint) => (
          <BlueprintChip
            key={blueprint.name}
            blueprint={blueprint}
            selected={selectedBlueprintName === blueprint.name}
            onSelect={() => onSelectBlueprint(blueprint.name)}
            gameDirectory={gameDirectory}
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onAddBlueprint}
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
  gameDirectory,
}: {
  blueprint: Blueprint;
  selected: boolean;
  onSelect: () => void;
  gameDirectory: string;
}) {
  const imageUrl = getBlueprintImageUrl(gameDirectory, blueprint.image);
  const fallbackLabel = blueprint.name.slice(0, 3).toUpperCase();
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(BLUEPRINT_MIME, blueprint.name);
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", blueprint.name);
      }}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-2 rounded-full border px-1 py-1 text-xs font-semibold transition ${
        selected
          ? "border-slate-400 bg-slate-100 text-slate-900"
          : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200"
      }`}
    >
      {imageUrl ? (
        <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-slate-200 shadow-inner">
          <img
            src={imageUrl}
            alt={`${blueprint.name} image`}
            className="h-full w-full object-cover"
            style={{ imageRendering: "pixelated" }}
          />
        </span>
      ) : (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-[10px] font-bold uppercase shadow-inner"
          style={{ backgroundColor: blueprint.color }}
        >
          <div className="flex items-center justify-center w-full">
            {fallbackLabel}
          </div>
        </span>
      )}
    </button>
  );
}
