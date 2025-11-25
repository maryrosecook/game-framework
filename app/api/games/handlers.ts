import { NextResponse } from "next/server";
import {
  gameSlug,
  isGameFile,
  isNotFoundError,
  readGameFile,
  writeEditorSettings,
  writeGameFile,
} from "@/lib/games";

type HandlerOptions = {
  updateEditorSettings?: boolean;
};

export async function loadGameResponse(
  gameDirectory: string,
  options: HandlerOptions = {}
) {
  const { updateEditorSettings = true } = options;

  if (!gameDirectory) {
    return NextResponse.json({ error: "Invalid game name" }, { status: 400 });
  }

  try {
    const game = await readGameFile(gameDirectory);
    if (updateEditorSettings) {
      await writeEditorSettings({ currentGameDirectory: gameDirectory });
    }
    return NextResponse.json({ game, gameDirectory });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to load game" }, { status: 500 });
  }
}

export async function saveGameResponse(
  gameDirectory: string,
  rawGame: unknown,
  options: HandlerOptions = {}
) {
  const { updateEditorSettings = true } = options;
  if (!gameDirectory) {
    return NextResponse.json({ error: "Invalid game name" }, { status: 400 });
  }

  if (!isGameFile(rawGame)) {
    return NextResponse.json(
      { error: "Invalid game payload" },
      { status: 400 }
    );
  }

  try {
    await writeGameFile(gameDirectory, rawGame);
    if (updateEditorSettings) {
      await writeEditorSettings({ currentGameDirectory: gameDirectory });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to save game" }, { status: 500 });
  }
}
