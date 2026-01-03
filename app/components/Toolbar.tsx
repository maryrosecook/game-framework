"use client";

import { Blueprint } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { Plus, RotateCw, Settings, X } from "lucide-react";
import { getBlueprintImageUrl, getPrimaryImageName } from "@/lib/images";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SettingsTab } from "@/components/SettingsTab";
import { GameSubscribe } from "@/engine/useGame";

const BLUEPRINT_MIME = "application/x-blueprint";

type ToolbarProps = {
  blueprints: Blueprint[];
  selectedBlueprintName: string | null;
  onSelectBlueprint: (name: string) => void;
  onAddBlueprint: () => void;
  onShare: () => void;
  canEdit: boolean;
  gameDirectory: string;
  imageVersions: Record<string, number>;
  subscribe: GameSubscribe;
};

export function Toolbar({
  blueprints,
  selectedBlueprintName,
  onSelectBlueprint,
  onAddBlueprint,
  onShare,
  canEdit,
  gameDirectory,
  imageVersions,
  subscribe,
}: ToolbarProps) {
  return (
    <div className="inline-flex max-w-[800px] min-w-fit items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-lg">
      <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => window.location.reload()}
          aria-label="Restart"
          className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        >
          <RotateCw className="size-4" />
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Settings"
              disabled={!canEdit}
              className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            >
              <Settings className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[360px] max-w-[92vw]">
            <DialogHeader className="flex-row items-center justify-between">
              <DialogTitle>Settings</DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close settings"
                  className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  <X className="size-4" />
                </button>
              </DialogClose>
            </DialogHeader>
            <SettingsTab subscribe={subscribe} />
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onShare}
          aria-label="Share"
          className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        >
          <ShareOutlineIcon className="size-4" />
        </Button>
      </div>
      <div className="flex flex-1 gap-2 overflow-x-auto py-1">
        {blueprints.map((blueprint) => {
          const primaryImage = getPrimaryImageName(blueprint.images);
          return (
            <BlueprintChip
              key={blueprint.name}
              blueprint={blueprint}
              selected={selectedBlueprintName === blueprint.name}
              onSelect={() => onSelectBlueprint(blueprint.name)}
              canEdit={canEdit}
              gameDirectory={gameDirectory}
              primaryImage={primaryImage}
              imageVersion={
                primaryImage ? imageVersions[primaryImage] : undefined
              }
            />
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={onAddBlueprint}
        aria-label="Add blueprint"
        disabled={!canEdit}
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
  canEdit,
  gameDirectory,
  imageVersion,
  primaryImage,
}: {
  blueprint: Blueprint;
  selected: boolean;
  onSelect: () => void;
  canEdit: boolean;
  gameDirectory: string;
  imageVersion?: number;
  primaryImage?: string;
}) {
  const imageUrl = getBlueprintImageUrl(
    gameDirectory,
    primaryImage,
    imageVersion
  );
  const fallbackLabel = blueprint.name.slice(0, 3).toUpperCase();
  return (
    <button
      type="button"
      draggable={canEdit}
      disabled={!canEdit}
      onDragStart={(event) => {
        if (!canEdit) {
          return;
        }
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

function ShareOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeWidth="32"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M336 176L256 96l-80 80" />
      <path d="M256 96v224" />
      <rect x="96" y="240" width="320" height="176" rx="16" ry="16" />
    </svg>
  );
}
