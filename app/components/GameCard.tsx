import type { GameSummary } from "@/lib/games";
import { DragEvent, MouseEvent } from "react";

export function GameCard({
  game,
  imageUrl,
  isActiveDrop,
  isUploading,
  onDropImage,
  onNavigate,
  onDragEnter,
  onDragLeave,
}: {
  game: GameSummary;
  imageUrl: string | null;
  isActiveDrop: boolean;
  isUploading: boolean;
  onDropImage: (event: DragEvent<HTMLButtonElement>) => void;
  onNavigate: (event: MouseEvent<HTMLButtonElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
}) {
  const label = toDisplayName(game.directory);
  return (
    <button
      type="button"
      onClick={onNavigate}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          onDragEnter();
        }
      }}
      onDragEnter={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          onDragEnter();
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          onDragLeave();
        }
      }}
      onDrop={onDropImage}
      className={`group relative aspect-square h-48 w-48 shrink-0 cursor-pointer bg-white shadow-lg ring-4 ring-transparent transition hover:ring-indigo-300 md:h-56 md:w-56 ${
        isActiveDrop ? "ring-indigo-300" : "hover:ring-indigo-300"
      }`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${label} cover`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className="absolute inset-0 flex h-full w-full items-center justify-center bg-slate-50" />
      )}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center bg-white px-3 py-2 text-sm font-semibold text-slate-900">
        <span className="block min-w-0 flex-1 truncate">{label}</span>
      </div>
      {isUploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-semibold text-indigo-600">
          Uploading…
        </div>
      ) : null}
      {isActiveDrop ? (
        <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-indigo-400" />
      ) : null}
    </button>
  );
}

function toDisplayName(directory: string): string {
  const parts = directory
    .split("-")
    .filter((segment) => segment.length > 0);

  if (parts.length === 0) return directory;

  const combined = parts.join(" ").toLowerCase();
  return combined.charAt(0).toUpperCase() + combined.slice(1);
}
