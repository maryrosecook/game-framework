import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BlueprintBehaviors,
  BlueprintData,
  GameFile,
  PersistedThing,
  PhysicsType,
  Shape,
  TriggerName,
} from "@/engine/types";

const ROOT = process.cwd();
const GAMES_ROOT = path.join(ROOT, "app", "games");
const EDITOR_SETTINGS_PATH = path.join(ROOT, "data", "editorSettings.json");
const DEFAULT_BACKGROUND_COLOR = "#f8fafc";
const MIN_BLUEPRINT_WEIGHT = 0.0001;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isNotFoundError(
  error: unknown
): error is NodeJS.ErrnoException {
  return isRecord(error) && "code" in error && error.code === "ENOENT";
}

function isExistingFileError(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && "code" in error && error.code === "EEXIST";
}

function isEditorSettings(value: unknown): value is EditorSettings {
  return isRecord(value) && typeof value.currentGameDirectory === "string";
}

function isVector(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

function isShape(value: unknown): value is Shape {
  return value === "rectangle" || value === "triangle" || value === "circle";
}

function isPhysicsType(value: unknown): value is PhysicsType {
  return value === "dynamic" || value === "static" || value === "ambient";
}

function isTriggerName(value: string): value is TriggerName {
  return (
    value === "create" ||
    value === "input" ||
    value === "update" ||
    value === "collision"
  );
}

function isBlueprintBehaviors(value: unknown): value is BlueprintBehaviors {
  if (!isRecord(value)) {
    return false;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!isTriggerName(key)) {
      return false;
    }
    if (
      !Array.isArray(entry) ||
      !entry.every((item) => typeof item === "string")
    ) {
      return false;
    }
  }
  return true;
}

function isThing(value: unknown): value is PersistedThing {
  if (!isRecord(value)) {
    return false;
  }
  const hasRequiredFields =
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.angle === "number" &&
    typeof value.velocityX === "number" &&
    typeof value.velocityY === "number" &&
    typeof value.blueprintName === "string";
  if (!hasRequiredFields) {
    return false;
  }

  const numericOptionalKeys: (keyof Pick<
    PersistedThing,
    "width" | "height"
  >)[] = ["width", "height"];
  const hasValidOptionalNumbers = numericOptionalKeys.every(
    (key) => value[key] === undefined || typeof value[key] === "number"
  );
  if (!hasValidOptionalNumbers) {
    return false;
  }

  if (value.physicsType !== undefined && !isPhysicsType(value.physicsType)) {
    return false;
  }
  if (value.color !== undefined && typeof value.color !== "string") {
    return false;
  }
  if (value.shape !== undefined) {
    return false;
  }
  return true;
}

function isBlueprintData(value: unknown): value is BlueprintData {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.name !== "string" ||
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    typeof value.z !== "number" ||
    typeof value.color !== "string" ||
    !isShape(value.shape) ||
    !isPhysicsType(value.physicsType)
  ) {
    return false;
  }
  if (value.image !== undefined && typeof value.image !== "string") {
    return false;
  }
  if (
    typeof value.weight !== "number" ||
    !Number.isFinite(value.weight) ||
    value.weight < MIN_BLUEPRINT_WEIGHT
  ) {
    return false;
  }
  if (
    typeof value.bounce !== "number" ||
    !Number.isFinite(value.bounce) ||
    value.bounce < 0 ||
    value.bounce > 1
  ) {
    return false;
  }
  if (value.behaviors !== undefined && !isBlueprintBehaviors(value.behaviors)) {
    return false;
  }
  return true;
}

export function isGameFile(value: unknown): value is GameFile {
  if (!isRecord(value)) {
    return false;
  }
  const hasValidId = typeof value.id === "number";
  const hasCamera = isVector(value.camera);
  const hasThings =
    Array.isArray(value.things) &&
    value.things.every((thing) => isThing(thing));
  const hasBlueprints =
    Array.isArray(value.blueprints) &&
    value.blueprints.every((bp) => isBlueprintData(bp));
  const hasBackgroundColor =
    value.backgroundColor === undefined ||
    typeof value.backgroundColor === "string" ||
    value.clearColor === undefined ||
    typeof value.clearColor === "string";
  const hasValidImage =
    value.image === undefined ||
    value.image === null ||
    typeof value.image === "string";
  const hasGravitySetting = typeof value.isGravityEnabled === "boolean";
  return (
    hasValidId &&
    hasCamera &&
    hasThings &&
    hasBlueprints &&
    hasBackgroundColor &&
    hasValidImage &&
    hasGravitySetting
  );
}
