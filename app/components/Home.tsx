"use client";

import { DragEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameSummary } from "@/lib/games";
import { getGameImageUrl } from "@/lib/images";
import { GameCard } from "./GameCard";

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
      const payload = (await response.json()) as {
        gameDirectory?: string;
        error?: string;
      };
      if (!response.ok || !payload.gameDirectory) {
        throw new Error(payload.error ?? "Failed to create game");
      }
      router.push(`/${payload.gameDirectory}`);
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
    const [file] = Array.from(event.dataTransfer.files ?? []);
    if (!file) return;
    if (
      file.type !== "image/png" &&
      !file.name.toLowerCase().endsWith(".png")
    ) {
      setUploadErrors((prev) => ({
        ...prev,
        [gameDirectory]: "Only PNG files are supported.",
      }));
      return;
    }

    setUploadErrors((prev) => ({ ...prev, [gameDirectory]: null }));
    setUploadingFor(gameDirectory);
    try {
      const imageName = await uploadGameImage(gameDirectory, file);
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
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-indigo-50 to-white text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Commando
            </p>
            <h1 className="text-3xl font-semibold leading-tight">
              Select a game
            </h1>
            <p className="text-sm text-slate-500">
              Drop a PNG on a game square to set its cover art.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:translate-y-[-1px] hover:bg-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-200"
            onClick={handleCreateGame}
            disabled={isCreating}
          >
            {isCreating ? "Creating…" : "New game"}
          </button>
        </header>

        <div className="relative flex justify-center">
          {gameCards.length === 0 ? (
            <p className="text-center text-sm text-slate-600">
              No games yet. Create one to start building.
            </p>
          ) : (
            <div className="flex max-w-full items-stretch gap-5 overflow-x-auto pb-2">
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
                    onNavigate={() => router.push(`/${game.directory}`)}
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
            </div>
          )}
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

async function uploadGameImage(gameDirectory: string, file: File) {
  const formData = new FormData();
  formData.append("gameDirectory", gameDirectory);
  formData.append("file", file);
  const response = await fetch("/api/images", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as {
    fileName?: string;
    error?: string;
  } | null;

  if (!response.ok || !payload?.fileName) {
    throw new Error(payload?.error ?? "Failed to upload image");
  }

  const settingsResponse = await fetch(
    `/api/game-settings/${encodeURIComponent(gameDirectory)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: payload.fileName }),
    }
  );

  const settingsPayload = (await settingsResponse.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!settingsResponse.ok) {
    throw new Error(
      settingsPayload?.error ?? "Failed to save game cover image"
    );
  }

  return payload.fileName;
}
