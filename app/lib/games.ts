import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  GameFile,
  isEditorSettings,
  isExistingFileError,
  isGameFile,
  isNotFoundError,
  isRecord,
} from "@/engine/types";
import { shouldIncludeEditKeyInHomeURL } from "@/lib/homeUrl";

const ROOT = process.cwd();
const GAMES_ROOT = path.join(ROOT, "data", "games");
const EDITOR_SETTINGS_PATH = path.join(ROOT, "data", "editorSettings.json");
const DEFAULT_BACKGROUND_COLOR = "#fbcfe8";
const GAME_NAME_PATTERN = /[^a-z0-9]+/g;
const GAME_EDIT_FILE_NAME = "game-edit.json";

type GameEditFile = {
  editKey: string;
};

export type EditorSettings = { currentGameDirectory: string };
export type GameSummary = {
  id: number;
  directory: string;
  image: string | null;
  editKey: string | null;
};

function createDefaultGameFile(id: number): GameFile {
  return {
    id,
    things: [],
    blueprints: [],
    camera: { x: 0, y: 0 },
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    isGravityEnabled: false,
    image: null,
  };
}

function createEditKey(): string {
  return randomBytes(24).toString("base64url");
}

function isGameEditFile(value: unknown): value is GameEditFile {
  return isRecord(value) && typeof value.editKey === "string";
}

const DEFAULT_CAMERA_TEMPLATE = `import { RuntimeGameState } from "@/engine/types";

export function update(game: RuntimeGameState) {
  return game.camera;
}
`;

export class InvalidGameNameError extends Error {
  constructor() {
    super("Game name must include at least one letter or number");
  }
}

export class GameAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Game "${name}" already exists`);
  }
}

export function gameSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(GAME_NAME_PATTERN, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listGames(): Promise<GameSummary[]> {
  const entries = await fs.readdir(GAMES_ROOT, { withFileTypes: true });
  const includeEditKeys = shouldIncludeEditKeyInHomeURL();
  const candidates: GameSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const gameFilePath = getGameFilePath(entry.name);
    const hasGameFile = await fileExists(gameFilePath);
    if (hasGameFile) {
      try {
        const game = await readGameFile(entry.name);
        const image = game.image ?? null;
        const editKey = includeEditKeys
          ? await readGameEditKeyForListing(entry.name)
          : null;
        candidates.push({
          id: game.id,
          directory: entry.name,
          image,
          editKey,
        });
      } catch (error) {
        console.warn("Failed to read game file for listing", error);
      }
    }
  }
  return candidates.sort((a, b) => {
    if (a.id !== b.id) return a.id - b.id;
    return a.directory.localeCompare(b.directory);
  });
}

export async function readEditorSettings(): Promise<EditorSettings> {
  const raw = await fs.readFile(EDITOR_SETTINGS_PATH, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isEditorSettings(parsed)) {
    throw new Error("Invalid editor settings file");
  }
  return parsed;
}

export async function writeEditorSettings(settings: EditorSettings) {
  await fs.writeFile(EDITOR_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function readGameFile(gameDirectory: string) {
  const gameFilePath = getGameFilePath(gameDirectory);
  const raw = await fs.readFile(gameFilePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error: unknown) {
    console.warn(`Invalid game file: ${gameFilePath}`);
    throw error;
  }
  if (!isGameFile(parsed)) {
    console.warn(`Invalid game file: ${gameFilePath}`);
    throw new Error("Invalid game file");
  }
  return parsed;
}

export async function writeGameFile(
  gameDirectory: string,
  data: GameFile
): Promise<void> {
  const gameFilePath = getGameFilePath(gameDirectory);
  await fs.writeFile(gameFilePath, JSON.stringify(data, null, 2));
}

export async function createGameDirectory(name: string) {
  const slug = gameSlug(name);
  if (!slug) {
    throw new InvalidGameNameError();
  }

  const directoryPath = getGameDirectoryPath(slug);
  const alreadyExists = await fileExists(directoryPath);
  if (alreadyExists) {
    throw new GameAlreadyExistsError(slug);
  }

  const id = await getNextGameId();
  await fs.mkdir(directoryPath, { recursive: true });
  await fs.mkdir(path.join(directoryPath, "blueprints"), { recursive: true });
  await writeGameFile(slug, createDefaultGameFile(id));
  const editKey = createEditKey();
  await writeGameEditFile(slug, { editKey });

  const cameraPath = path.join(directoryPath, "camera.ts");
  await fs
    .writeFile(cameraPath, DEFAULT_CAMERA_TEMPLATE, { flag: "wx" })
    .catch((error: unknown) => {
      if (!isExistingFileError(error)) {
        throw error;
      }
    });

  await writeEditorSettings({ currentGameDirectory: slug });
  return { gameDirectory: slug, editKey };
}

async function getNextGameId() {
  const games = await listGames();
  const maxId = games.reduce((max, game) => Math.max(max, game.id), -1);
  return maxId + 1;
}

function getGameDirectoryPath(name: string) {
  return path.join(GAMES_ROOT, name);
}

function getGameFilePath(name: string) {
  return path.join(getGameDirectoryPath(name), "game.json");
}

function getGameEditFilePath(name: string) {
  return path.join(getGameDirectoryPath(name), GAME_EDIT_FILE_NAME);
}

async function writeGameEditFile(gameDirectory: string, data: GameEditFile) {
  const editPath = getGameEditFilePath(gameDirectory);
  await fs.writeFile(editPath, JSON.stringify(data, null, 2));
}

async function readGameEditFile(gameDirectory: string): Promise<GameEditFile> {
  const editPath = getGameEditFilePath(gameDirectory);
  const raw = await fs.readFile(editPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);
  if (!isGameEditFile(parsed)) {
    throw new Error("Invalid game edit file");
  }
  return parsed;
}

async function readGameEditKeyForListing(
  gameDirectory: string
): Promise<string | null> {
  try {
    const editFile = await readGameEditFile(gameDirectory);
    return editFile.editKey;
  } catch (error) {
    console.warn("Failed to read game edit key for listing", error);
    return null;
  }
}

export async function validateEditKey(
  gameDirectory: string,
  editKey: string | null
): Promise<boolean> {
  if (!editKey) {
    return false;
  }
  try {
    const editFile = await readGameEditFile(gameDirectory);
    return editFile.editKey === editKey;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return false;
    }
    throw error;
  }
}
