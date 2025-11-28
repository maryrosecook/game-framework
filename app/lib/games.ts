import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BlueprintData,
  GameFile,
  PhysicsType,
  RawThing,
  Shape,
} from "@/engine/types";

const ROOT = process.cwd();
const GAMES_ROOT = path.join(ROOT, "app", "games");
const EDITOR_SETTINGS_PATH = path.join(ROOT, "data", "editorSettings.json");
const DEFAULT_BACKGROUND_COLOR = "#f8fafc";

const GAME_NAME_PATTERN = /[^a-z0-9]+/g;

export type EditorSettings = { currentGameDirectory: string };
export type GameSummary = { directory: string; image: string | null };

const DEFAULT_GAME_FILE: GameFile = {
  things: [],
  blueprints: [],
  camera: { x: 0, y: 0 },
  screen: { width: 800, height: 600 },
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  image: null,
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

export async function listGames(): Promise<GameSummary[]> {
  const entries = await fs.readdir(GAMES_ROOT, { withFileTypes: true });
  const candidates: GameSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const gameFilePath = getGameFilePath(entry.name);
    const hasGameFile = await fileExists(gameFilePath);
    if (hasGameFile) {
      let image: string | null = null;
      try {
        const game = await readGameFile(entry.name);
        image = game.image ?? null;
      } catch (error) {
        console.warn("Failed to read game file for listing", error);
      }
      candidates.push({ directory: entry.name, image });
    }
  }
  return candidates.sort((a, b) => a.directory.localeCompare(b.directory));
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

export function isNotFoundError(
  error: unknown
): error is NodeJS.ErrnoException {
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

function isEditorSettings(value: unknown): value is EditorSettings {
  return (
    typeof value === "object" &&
    value !== null &&
    "currentGameDirectory" in value &&
    typeof (value as { currentGameDirectory: unknown }).currentGameDirectory ===
      "string"
  );
}

function isVector(value: unknown): value is { x: number; y: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as { x?: unknown; y?: unknown };
  return typeof record.x === "number" && typeof record.y === "number";
}

function isScreen(value: unknown): value is { width: number; height: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as { width?: unknown; height?: unknown };
  return typeof record.width === "number" && typeof record.height === "number";
}

function isShape(value: unknown): value is Shape {
  return value === "rectangle" || value === "triangle";
}

function isPhysicsType(value: unknown): value is PhysicsType {
  return value === "dynamic" || value === "static" || value === "ambient";
}

function isThing(value: unknown): value is RawThing {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const hasRequiredFields =
    typeof record.id === "string" &&
    typeof record.x === "number" &&
    typeof record.y === "number" &&
    typeof record.angle === "number" &&
    typeof record.velocityX === "number" &&
    typeof record.velocityY === "number" &&
    typeof record.blueprintName === "string";
  if (!hasRequiredFields) {
    return false;
  }

  const numericOptionalKeys: (keyof Pick<RawThing, "width" | "height">)[] = [
    "width",
    "height",
  ];
  const hasValidOptionalNumbers = numericOptionalKeys.every(
    (key) => record[key] === undefined || typeof record[key] === "number"
  );
  if (!hasValidOptionalNumbers) {
    return false;
  }

  if (record.physicsType !== undefined && !isPhysicsType(record.physicsType)) {
    return false;
  }
  if (record.color !== undefined && typeof record.color !== "string") {
    return false;
  }
  if (record.shape !== undefined && !isShape(record.shape)) {
    return false;
  }
  return true;
}

function isBlueprintData(value: unknown): value is BlueprintData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === "string" &&
    typeof record.width === "number" &&
    typeof record.height === "number" &&
    typeof record.z === "number" &&
    typeof record.color === "string" &&
    isShape(record.shape) &&
    isPhysicsType(record.physicsType) &&
    (record.image === undefined || typeof record.image === "string")
  );
}

export function isGameFile(value: unknown): value is GameFile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const hasCamera = isVector(record.camera);
  const hasScreen = isScreen(record.screen);
  const hasThings =
    Array.isArray(record.things) &&
    record.things.every((thing) => isThing(thing));
  const hasBlueprints =
    Array.isArray(record.blueprints) &&
    record.blueprints.every((bp) => isBlueprintData(bp));
  const hasBackgroundColor =
    record.backgroundColor === undefined ||
    typeof record.backgroundColor === "string" ||
    record.clearColor === undefined ||
    typeof record.clearColor === "string";
  const hasValidImage =
    record.image === undefined ||
    record.image === null ||
    typeof record.image === "string";
  return (
    hasCamera &&
    hasScreen &&
    hasThings &&
    hasBlueprints &&
    hasBackgroundColor &&
    hasValidImage
  );
}
