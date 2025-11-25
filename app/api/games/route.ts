import { NextResponse } from "next/server";
import {
  GameAlreadyExistsError,
  InvalidGameNameError,
  createGameDirectory,
  listGames,
} from "@/lib/games";
import { getErrorMessage } from "@/lib/errors";

export async function GET() {
  try {
    const games = await listGames();
    return NextResponse.json({ games });
  } catch (error) {
    console.warn("Failed to list games", error);
    return NextResponse.json(
      { error: "Failed to list games", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as unknown;
  const name =
    payload && typeof payload === "object" && "name" in payload
      ? (payload as { name: unknown }).name
      : null;
  if (typeof name !== "string") {
    return NextResponse.json(
      { error: "Provide a game name" },
      { status: 400 }
    );
  }

  try {
    const result = await createGameDirectory(name);
    return NextResponse.json({
      ok: true,
      gameDirectory: result.gameDirectory,
    });
  } catch (error) {
    if (error instanceof InvalidGameNameError) {
      return NextResponse.json(
        { error: "Game name must include letters or numbers" },
        { status: 400 }
      );
    }
    if (error instanceof GameAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to create game", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
