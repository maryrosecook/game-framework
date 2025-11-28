import type { GameSummary } from "@/lib/games";
import { DragEvent } from "react";

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
  onNavigate: () => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
}) {
  const label = game.directory;
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
      className={`group relative aspect-square w-48 rounded-2xl border-2 bg-white shadow-lg transition md:w-56 ${
        isActiveDrop
          ? "border-indigo-400 ring-4 ring-indigo-100"
          : "border-slate-200 hover:-translate-y-1 hover:border-indigo-300"
      }`}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`${label} cover`}
          className="absolute inset-0 h-full w-full rounded-[14px] object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className="absolute inset-0 flex h-full w-full items-center justify-center rounded-[14px] bg-slate-50 text-sm font-semibold text-slate-500">
          Drop cover art (PNG)
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-[14px] bg-gradient-to-t from-white/90 via-white/20 to-transparent opacity-100 transition group-hover:from-white/70" />
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-sm font-semibold text-slate-900">
        <span className="truncate">{label}</span>
        <span className="rounded-full bg-indigo-600 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
          Open
        </span>
      </div>
      {isUploading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-white/80 text-sm font-semibold text-indigo-600">
          Uploading…
        </div>
      ) : null}
      {isActiveDrop ? (
        <div className="pointer-events-none absolute inset-0 rounded-[14px] border-2 border-dashed border-indigo-400" />
      ) : null}
    </button>
  );
}
