"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type HomeProps = {
  games: string[];
};

export function Home({ games }: HomeProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const sortedGames = useMemo(
    () => [...games].sort((a, b) => a.localeCompare(b)),
    [games]
  );

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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-900 px-6 py-12 text-white">
      <div className="w-full max-w-3xl space-y-8 rounded-2xl bg-slate-800/70 p-10 shadow-2xl ring-1 ring-white/10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Commando
            </p>
            <h1 className="text-3xl font-semibold">Select a game</h1>
          </div>
          <button
            type="button"
            className="rounded-full bg-lime-400 px-5 py-2 text-slate-950 transition hover:bg-lime-300 focus:outline-none focus:ring-4 focus:ring-lime-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            onClick={handleCreateGame}
            disabled={isCreating}
          >
            {isCreating ? "Creating…" : "New game"}
          </button>
        </header>

        <div className="space-y-3">
          {sortedGames.length === 0 ? (
            <p className="text-slate-300">No games yet. Create one to start.</p>
          ) : (
            sortedGames.map((game) => (
              <Link
                key={game}
                href={`/${game}`}
                className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition hover:-translate-y-0.5 hover:border-lime-300 hover:bg-white/10 hover:text-white"
              >
                <div className="flex flex-col">
                  <span className="text-lg font-medium">{game}</span>
                  <span className="text-sm text-slate-300">
                    Open editor and runtime
                  </span>
                </div>
                <span className="text-sm font-semibold text-lime-300 opacity-0 transition group-hover:opacity-100">
                  Launch →
                </span>
              </Link>
            ))
          )}
        </div>

        {error ? (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-100 ring-1 ring-red-500/30">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
