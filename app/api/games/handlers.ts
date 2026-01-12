import { NextResponse } from "next/server";
import {
  readGameFile,
  writeEditorSettings,
  writeGameFile,
} from "@/lib/games";
import { isGameFile, isNotFoundError } from "@/engine/types";
import { getErrorMessage } from "@/lib/errors";
import { canEditGame } from "@/lib/editAccess";

type HandlerOptions = {
  updateEditorSettings?: boolean;
};

export async function loadGameResponse(
  request: Request | null,
  gameDirectory: string,
  editKey: string | null,
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
    const canEdit = await canEditGame(request, gameDirectory, editKey);
    return NextResponse.json({ game, gameDirectory, canEdit });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load game", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function saveGameResponse(
  request: Request,
  gameDirectory: string,
  rawGame: unknown,
  editKey: string | null,
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
    const canEdit = await canEditGame(request, gameDirectory, editKey);
    if (!canEdit) {
      return NextResponse.json(
        { error: "Edit access required" },
        { status: 403 }
      );
    }
    await writeGameFile(gameDirectory, rawGame);
    if (updateEditorSettings) {
      await writeEditorSettings({ currentGameDirectory: gameDirectory });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to save game", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
