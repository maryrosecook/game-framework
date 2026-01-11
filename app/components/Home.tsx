"use client";

import { DragEvent, MouseEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameSummary } from "@/lib/games";
import { getGameImageUrl } from "@/lib/images";
import { GameCard } from "./GameCard";
import { getDroppedPngFile, uploadGameCoverImage } from "@/lib/imageUploads";
import { isRecord } from "@/engine/types";
import { shouldIncludeEditKeyInHomeURL } from "@/lib/homeUrl";

type HomeProps = {
  games: GameSummary[];
};

export function Home({ games }: HomeProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [gameCards, setGameCards] = useState<GameSummary[]>(games);
  const [activeDrop, setActiveDrop] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<
    Record<string, string | null>
  >({});
  const includeEditKeyInHomeURL = shouldIncludeEditKeyInHomeURL();

  function handleNavigate(
    game: GameSummary,
    event: MouseEvent<HTMLButtonElement>
  ) {
    const targetPath = buildGamePath(game, includeEditKeyInHomeURL);
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      event.preventDefault();
      window.open(targetPath, "_blank", "noopener,noreferrer");
      return;
    }

    router.push(targetPath);
  }

  const handleCreateGame = async () => {
    const name = window.prompt("Name your new game");
    if (!name) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json().catch(() => null);
      const gameDirectory =
        isRecord(payload) && typeof payload.gameDirectory === "string"
          ? payload.gameDirectory
          : null;
      const editKey =
        isRecord(payload) && typeof payload.editKey === "string"
          ? payload.editKey
          : null;
      const errorMessage =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : null;
      if (!response.ok || !gameDirectory || !editKey) {
        throw new Error(errorMessage ?? "Failed to create game");
      }
      router.push(
        `/games/${gameDirectory}?edit=${encodeURIComponent(editKey)}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create game";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDropImage = async (
    gameDirectory: string,
    event: DragEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveDrop(null);
    const { file, error } = getDroppedPngFile(event);
    if (error) {
      setUploadErrors((prev) => ({
        ...prev,
        [gameDirectory]: error,
      }));
      return;
    }
    if (!file) return;

    setUploadErrors((prev) => ({ ...prev, [gameDirectory]: null }));
    setUploadingFor(gameDirectory);
    try {
      const imageName = await uploadGameCoverImage({
        gameDirectory,
        file,
      });
      setGameCards((previous) =>
        previous.map((entry) =>
          entry.directory === gameDirectory
            ? { ...entry, image: imageName }
            : entry
        )
      );
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to save image";
      setUploadErrors((prev) => ({ ...prev, [gameDirectory]: message }));
    } finally {
      setUploadingFor(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#7bbdff] to-[#f4a3e4] text-slate-900">
      <div className="flex w-full flex-col gap-8 px-6 py-10 sm:px-10 lg:px-[100px]">
        <header className="text-left">
          <h1 className="text-2xl font-semibold leading-tight text-slate-900">
            Game editor
          </h1>
        </header>
        <div className="relative flex justify-start">
          <div className="flex w-full flex-wrap items-stretch justify-start gap-5 pb-2">
            {gameCards.map((game) => (
              <div key={game.directory} className="flex flex-col gap-2">
                <GameCard
                  game={game}
                  isActiveDrop={activeDrop === game.directory}
                  isUploading={uploadingFor === game.directory}
                  imageUrl={getGameImageUrl(game.directory, game.image)}
                  onDropImage={(event) =>
                    handleDropImage(game.directory, event)
                  }
                  onNavigate={(event) => handleNavigate(game, event)}
                  onDragEnter={() => setActiveDrop(game.directory)}
                  onDragLeave={() => setActiveDrop(null)}
                />
                {uploadErrors[game.directory] ? (
                  <p className="text-xs text-red-600">
                    {uploadErrors[game.directory]}
                  </p>
                ) : null}
              </div>
            ))}
            <NewGameTile onCreate={handleCreateGame} isCreating={isCreating} />
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildGamePath(
  game: GameSummary,
  includeEditKeyInHomeURL: boolean
): string {
  const base = `/games/${game.directory}`;
  if (!includeEditKeyInHomeURL) {
    return base;
  }
  if (!game.editKey) {
    throw new Error(`Missing edit key for ${game.directory}`);
  }
  return `${base}?edit=${encodeURIComponent(game.editKey)}`;
}

function NewGameTile({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCreate}
      disabled={isCreating}
      className="group relative aspect-square h-48 w-48 shrink-0 cursor-pointer bg-white shadow-lg ring-4 ring-transparent transition hover:ring-indigo-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 md:h-56 md:w-56"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-5xl font-semibold text-slate-300 transition group-hover:text-indigo-400">
          {isCreating ? "…" : "+"}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center bg-white px-3 py-2 text-sm font-semibold text-slate-900">
        <span className="block min-w-0 flex-1 truncate">New game</span>
      </div>
    </button>
  );
}
