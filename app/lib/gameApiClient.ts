import { GameEngineDependencies, LoadedGame } from "@/engine/engine";
import { createTimeWitnessDrive } from "@/engine/timeWitnessDrive";
import { GameFile, isGameFile, isRecord } from "@/engine/types";
import {
  EditableImageRecord,
  persistEditableImage,
} from "@/engine/editableImages";

type GameApiPayload = {
  game?: unknown;
  gameDirectory?: unknown;
  canEdit?: unknown;
  error?: unknown;
};

type GameApiClientOptions = {
  editKey?: string | null;
  onEditAccess?: (canEdit: boolean) => void;
};

export function createGameEngineDependencies(
  options: GameApiClientOptions = {}
): GameEngineDependencies {
  const { editKey, onEditAccess } = options;
  return {
    dataSource: {
      loadGame: (gameDirectory) =>
        loadGame(gameDirectory, editKey, onEditAccess),
      persistGame: (gameDirectory, game) =>
        persistGame(gameDirectory, game, editKey),
    },
    sideEffects: {
      onBlueprintCreated: (input) => scaffoldBlueprintFile(input, editKey),
      onBlueprintRenamed: (input) => renameBlueprintFile(input, editKey),
    },
    persistImage: (record) => persistImage(record, editKey),
    timeWitnessDrive: createTimeWitnessDrive(),
  };
}

async function loadGame(
  gameDirectory: string,
  editKey: string | null | undefined,
  onEditAccess?: (canEdit: boolean) => void
): Promise<LoadedGame> {
  const url = withEditKey(
    `/api/games/${encodeURIComponent(gameDirectory)}`,
    editKey
  );
  const response = await fetch(url);
  const payload = await readJson(response);
  const canEdit = getCanEdit(payload);
  onEditAccess?.(canEdit);
  if (!response.ok) {
    const message =
      getPayloadError(payload) ?? "Failed to load game";
    throw new Error(message);
  }
  return parseLoadedGame(payload);
}

async function persistGame(
  gameDirectory: string,
  game: GameFile,
  editKey: string | null | undefined
) {
  const url = withEditKey(
    `/api/games/${encodeURIComponent(gameDirectory)}`,
    editKey
  );
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game }),
  });
  if (!response.ok) {
    const payload = await readJson(response);
    const message =
      getPayloadError(payload) ?? "Failed to save game";
    throw new Error(message);
  }
}

async function scaffoldBlueprintFile(
  input: {
    gameDirectory: string;
    blueprintName: string;
  },
  editKey: string | null | undefined
) {
  const url = withEditKey("/api/blueprints", editKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to scaffold blueprint file");
  }
}

async function renameBlueprintFile(
  input: {
    gameDirectory: string;
    previousName: string;
    nextName: string;
  },
  editKey: string | null | undefined
) {
  const url = withEditKey("/api/blueprints", editKey);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to rename blueprint file");
  }
}

async function persistImage(
  record: EditableImageRecord,
  editKey: string | null | undefined
): Promise<boolean> {
  if (!editKey) {
    return false;
  }
  const src = withEditKey(record.src, editKey);
  return persistEditableImage({ ...record, src });
}

function parseLoadedGame(payload: unknown): LoadedGame {
  if (!isRecord(payload)) {
    throw new Error("Invalid game response");
  }
  if (!isGameFile(payload.game)) {
    throw new Error("Invalid game response");
  }
  if (typeof payload.gameDirectory !== "string") {
    throw new Error("Invalid game response");
  }
  return {
    gameDirectory: payload.gameDirectory,
    game: payload.game,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getPayloadError(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  return typeof payload.error === "string" ? payload.error : null;
}

function getCanEdit(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false;
  }
  return payload.canEdit === true;
}

function withEditKey(path: string, editKey: string | null | undefined): string {
  if (!editKey) {
    return path;
  }
  const divider = path.includes("?") ? "&" : "?";
  return `${path}${divider}edit=${encodeURIComponent(editKey)}`;
}
