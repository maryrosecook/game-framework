import { promises as fs } from "node:fs";
import path from "node:path";
import {
  GameFile,
  isEditorSettings,
  isExistingFileError,
  isGameFile,
  isNotFoundError,
} from "@/engine/types";

const ROOT = process.cwd();
const GAMES_ROOT = path.join(ROOT, "app", "games");
const EDITOR_SETTINGS_PATH = path.join(ROOT, "data", "editorSettings.json");
const DEFAULT_BACKGROUND_COLOR = "#f8fafc";
const GAME_NAME_PATTERN = /[^a-z0-9]+/g;

export type EditorSettings = { currentGameDirectory: string };
export type GameSummary = {
  id: number;
  directory: string;
  image: string | null;
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
  const candidates: GameSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const gameFilePath = getGameFilePath(entry.name);
    const hasGameFile = await fileExists(gameFilePath);
    if (hasGameFile) {
      try {
        const game = await readGameFile(entry.name);
        const image = game.image ?? null;
        candidates.push({ id: game.id, directory: entry.name, image });
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
  const parsed = JSON.parse(raw) as unknown;
  if (!isGameFile(parsed)) {
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

  const cameraPath = path.join(directoryPath, "camera.ts");
  await fs
    .writeFile(cameraPath, DEFAULT_CAMERA_TEMPLATE, { flag: "wx" })
    .catch((error: unknown) => {
      if (!isExistingFileError(error)) {
        throw error;
      }
    });

  await writeEditorSettings({ currentGameDirectory: slug });
  return { gameDirectory: slug };
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
