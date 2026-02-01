import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readGameFile } from "./games";

const GAMES_ROOT = path.join(process.cwd(), "data", "games");

let tempGameDirectory: string | null = null;

function createTempGameDirectoryName(): string {
  return `invalid-game-${randomBytes(6).toString("hex")}`;
}

async function writeInvalidGameFile(gameDirectory: string): Promise<string> {
  const directoryPath = path.join(GAMES_ROOT, gameDirectory);
  await fs.mkdir(directoryPath, { recursive: true });
  const gameFilePath = path.join(directoryPath, "game.json");
  await fs.writeFile(gameFilePath, JSON.stringify({}));
  return gameFilePath;
}

async function removeTempGameDirectory() {
  if (!tempGameDirectory) return;
  await fs.rm(path.join(GAMES_ROOT, tempGameDirectory), {
    recursive: true,
    force: true,
  });
  tempGameDirectory = null;
}

afterEach(async () => {
  await removeTempGameDirectory();
  vi.restoreAllMocks();
});

describe("readGameFile", () => {
  it("logs a warning when the game file is invalid", async () => {
    const gameDirectory = createTempGameDirectoryName();
    tempGameDirectory = gameDirectory;
    const gameFilePath = await writeInvalidGameFile(gameDirectory);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(readGameFile(gameDirectory)).rejects.toThrow(
      "Invalid game file"
    );
    expect(warnSpy).toHaveBeenCalledWith(`Invalid game file: ${gameFilePath}`);
  });
});
