import { promises as fs } from "node:fs";
import path from "node:path";
import { GameFile } from "@/engine/types";

const ROOT = process.cwd();
const GAMES_ROOT = path.join(ROOT, "app", "games");
const EDITOR_SETTINGS_PATH = path.join(ROOT, "data", "editorSettings.json");

const GAME_NAME_PATTERN = /[^a-z0-9]+/g;

export type EditorSettings = { currentGameDirectory: string };

const DEFAULT_GAME_FILE: GameFile = {
  things: [],
  blueprints: [],
  camera: { x: 0, y: 0 },
  screen: { width: 800, height: 600 },
};

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

export async function listGames() {
  const entries = await fs.readdir(GAMES_ROOT, { withFileTypes: true });
  const candidates: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const gameFilePath = getGameFilePath(entry.name);
    const hasGameFile = await fileExists(gameFilePath);
    if (hasGameFile) {
      candidates.push(entry.name);
    }
  }
  return candidates.sort();
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

  await fs.mkdir(directoryPath, { recursive: true });
  await fs.mkdir(path.join(directoryPath, "blueprints"), { recursive: true });
  await writeGameFile(slug, DEFAULT_GAME_FILE);

  const cameraPath = path.join(directoryPath, "camera.ts");
  await fs.writeFile(cameraPath, DEFAULT_CAMERA_TEMPLATE, { flag: "wx" }).catch(
    (error: unknown) => {
      if (!isExistingFileError(error)) {
        throw error;
      }
    }
  );

  await writeEditorSettings({ currentGameDirectory: slug });
  return { gameDirectory: slug };
}

function getGameDirectoryPath(name: string) {
  return path.join(GAMES_ROOT, name);
}

function getGameFilePath(name: string) {
  return path.join(getGameDirectoryPath(name), "game.json");
}

function isEditorSettings(value: unknown): value is EditorSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "currentGameDirectory" in value &&
    typeof (value as { currentGameDirectory: unknown }).currentGameDirectory ===
      "string"
  );
}

export function isGameFile(value: unknown): value is GameFile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const hasCamera =
    typeof record.camera === "object" &&
    record.camera !== null &&
    typeof (record.camera as { x?: unknown }).x === "number" &&
    typeof (record.camera as { y?: unknown }).y === "number";
  const hasScreen =
    typeof record.screen === "object" &&
    record.screen !== null &&
    typeof (record.screen as { width?: unknown }).width === "number" &&
    typeof (record.screen as { height?: unknown }).height === "number";
  const hasThings =
    Array.isArray(record.things) &&
    record.things.every((thing) => typeof thing === "object");
  const hasBlueprints =
    Array.isArray(record.blueprints) &&
    record.blueprints.every((bp) => typeof bp === "object");
  return hasCamera && hasScreen && hasThings && hasBlueprints;
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

export function isNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function isExistingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}
