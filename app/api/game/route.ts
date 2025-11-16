import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GameFile } from "@/engine/types";

const ROOT = process.cwd();
const EDITOR_SETTINGS_PATH = path.join(ROOT, "data", "editorSettings.json");

async function readEditorSettings() {
  const raw = await fs.readFile(EDITOR_SETTINGS_PATH, "utf-8");
  return JSON.parse(raw) as { currentGameDirectory: string };
}

async function readGameFile(gameDirectory: string) {
  const gamePath = path.join(ROOT, "app", "games", gameDirectory, "game.json");
  const raw = await fs.readFile(gamePath, "utf-8");
  return JSON.parse(raw) as GameFile;
}

async function writeGameFile(gameDirectory: string, data: GameFile) {
  const gamePath = path.join(ROOT, "app", "games", gameDirectory, "game.json");
  await fs.writeFile(gamePath, JSON.stringify(data, null, 2));
}

export async function GET() {
  const settings = await readEditorSettings();
  const game = await readGameFile(settings.currentGameDirectory);
  return NextResponse.json({
    game,
    gameDirectory: settings.currentGameDirectory,
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    gameDirectory: string;
    game: GameFile;
  };
  await writeGameFile(payload.gameDirectory, payload.game);
  return NextResponse.json({ ok: true });
}
