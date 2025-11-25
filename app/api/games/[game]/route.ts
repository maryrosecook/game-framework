import { NextResponse } from "next/server";
import {
  gameSlug,
  isGameFile,
  isNotFoundError,
  readGameFile,
  writeEditorSettings,
  writeGameFile,
} from "@/lib/games";

type RouteContext = {
  params: { game: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const gameDirectory = normalizeGameParam(context.params.game);
  if (!gameDirectory) {
    return NextResponse.json(
      { error: "Invalid game name" },
      { status: 400 }
    );
  }

  try {
    const game = await readGameFile(gameDirectory);
    await writeEditorSettings({ currentGameDirectory: gameDirectory });
    return NextResponse.json({ game, gameDirectory });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load game" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const gameDirectory = normalizeGameParam(context.params.game);
  if (!gameDirectory) {
    return NextResponse.json(
      { error: "Invalid game name" },
      { status: 400 }
    );
  }

  const payload = (await request.json()) as unknown;
  const game =
    payload && typeof payload === "object" && "game" in payload
      ? (payload as { game: unknown }).game
      : null;

  if (!isGameFile(game)) {
    return NextResponse.json(
      { error: "Invalid game payload" },
      { status: 400 }
    );
  }

  try {
    await writeGameFile(gameDirectory, game);
    await writeEditorSettings({ currentGameDirectory: gameDirectory });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to save game" },
      { status: 500 }
    );
  }
}

function normalizeGameParam(raw: string) {
  const slug = gameSlug(raw);
  if (!slug) {
    return null;
  }
  return slug;
}
