import { NextResponse } from "next/server";
import {
  gameSlug,
  readGameFile,
  writeGameFile,
} from "@/lib/games";
import { isNotFoundError, isRecord } from "@/engine/types";
import { getErrorMessage } from "@/lib/errors";
import { extractEditKeyFromRequest } from "@/lib/editKey";
import { normalizeImageFileName } from "@/lib/images";
import { canEditGame } from "@/lib/editAccess";

type RouteContext = {
  params: Promise<{ game: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const slug = gameSlug(params.game);
  if (!slug) {
    return NextResponse.json({ error: "Invalid game name" }, { status: 400 });
  }

  try {
    const game = await readGameFile(slug);
    return NextResponse.json({
      image: game.image ?? null,
      gameDirectory: slug,
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to read game file", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const params = await context.params;
  const slug = gameSlug(params.game);
  if (!slug) {
    return NextResponse.json({ error: "Invalid game name" }, { status: 400 });
  }

  const editKey = extractEditKeyFromRequest(request);
  const canEdit = await canEditGame(request, slug, editKey);
  if (!canEdit) {
    return NextResponse.json(
      { error: "Edit access required" },
      { status: 403 }
    );
  }

  const payload = await request.json().catch(() => null);
  if (!isRecord(payload) || !("image" in payload)) {
    return NextResponse.json(
      { error: "Provide an image filename or null" },
      { status: 400 }
    );
  }

  const image = payload.image;
  if (image !== null && typeof image !== "string") {
    return NextResponse.json(
      { error: "Image must be a filename or null" },
      { status: 400 }
    );
  }

  const normalizedImage =
    typeof image === "string" ? normalizeImageFileName(image) : null;
  if (image !== null && normalizedImage === null) {
    return NextResponse.json(
      { error: "Invalid image filename" },
      { status: 400 }
    );
  }

  try {
    const game = await readGameFile(slug);
    const nextGame = { ...game, image: normalizedImage };
    await writeGameFile(slug, nextGame);
    return NextResponse.json({ ok: true, image: normalizedImage });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    return NextResponse.json(
      {
        error: "Failed to update game image",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
