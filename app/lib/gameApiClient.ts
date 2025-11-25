import { GameEngineDependencies, LoadedGame } from "@/engine/engine";
import { GameFile } from "@/engine/types";

type GameApiPayload = {
  game?: unknown;
  gameDirectory?: unknown;
  error?: unknown;
};

export function createGameEngineDependencies(): GameEngineDependencies {
  return {
    dataSource: {
      loadGame,
      persistGame,
    },
    sideEffects: {
      onBlueprintCreated: scaffoldBlueprintFile,
      onBlueprintRenamed: renameBlueprintFile,
    },
  };
}

async function loadGame(gameDirectory: string): Promise<LoadedGame> {
  console.log(gameDirectory);
  const response = await fetch(
    `/api/games/${encodeURIComponent(gameDirectory)}`
  );
  const payload = (await response
    .json()
    .catch(() => null)) as GameApiPayload | null;
  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to load game";
    throw new Error(message);
  }
  return parseLoadedGame(payload);
}

async function persistGame(gameDirectory: string, game: GameFile) {
  const response = await fetch(
    `/api/games/${encodeURIComponent(gameDirectory)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game }),
    }
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to save game";
    throw new Error(message);
  }
}

async function scaffoldBlueprintFile(input: {
  gameDirectory: string;
  blueprintName: string;
}) {
  const response = await fetch("/api/blueprints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to scaffold blueprint file");
  }
}

async function renameBlueprintFile(input: {
  gameDirectory: string;
  previousName: string;
  nextName: string;
}) {
  const response = await fetch("/api/blueprints", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to rename blueprint file");
  }
}

function parseLoadedGame(payload: GameApiPayload | null): LoadedGame {
  if (!payload || !payload.game || typeof payload.gameDirectory !== "string") {
    throw new Error("Invalid game response");
  }
  return {
    gameDirectory: payload.gameDirectory,
    game: payload.game as GameFile,
  };
}
