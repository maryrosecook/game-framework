import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { blueprintSlug, blueprintTemplate } from "@/lib/blueprints";
import { getErrorMessage } from "@/lib/errors";
import {
  gameSlug,
  readGameFile,
  writeGameFile,
} from "@/lib/games";
import type { GameFile } from "@/engine/types";
import { z, type ZodType } from "zod";
import { extractEditKeyFromUrl } from "@/lib/editKey";
import { requireEditAccess } from "@/lib/editAccess";

const ROOT = process.cwd();
const GAMES_ROOT = path.join(ROOT, "data", "games");

const blueprintCreateSchema = z.object({
  gameDirectory: z.string(),
  blueprintName: z.string(),
});

const blueprintRenameSchema = z.object({
  gameDirectory: z.string(),
  previousName: z.string(),
  nextName: z.string(),
});

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parsePayload<T>(schema: ZodType<T>, payload: unknown): T | null {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return null;
  }
  return result.data;
}

async function renameBlueprintInGameFile(
  gameDirectory: string,
  previousName: string,
  nextName: string
): Promise<boolean> {
  const game = await readGameFile(gameDirectory);
  const initial = applyBlueprintRename(game, previousName, nextName);
  if (!initial.updated) {
    return false;
  }

  const latest = await readGameFile(gameDirectory);
  const next = applyBlueprintRename(latest, previousName, nextName);
  if (!next.updated) {
    return false;
  }

  await writeGameFile(gameDirectory, next.game);
  return true;
}

function applyBlueprintRename(
  game: GameFile,
  previousName: string,
  nextName: string
): { updated: boolean; game: GameFile } {
  let updated = false;

  const blueprints = game.blueprints.map((blueprint) => {
    if (blueprint.name !== previousName) {
      return blueprint;
    }
    updated = true;
    return { ...blueprint, name: nextName };
  });

  const things = game.things.map((thing) => {
    if (thing.blueprintName !== previousName) {
      return thing;
    }
    updated = true;
    return { ...thing, blueprintName: nextName };
  });

  if (!updated) {
    return { updated: false, game };
  }

  return { updated: true, game: { ...game, blueprints, things } };
}

// Returns content of blueprint file
export async function POST(request: Request) {
  const payload = parsePayload(blueprintCreateSchema, await readJson(request));

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid blueprint data" },
      { status: 400 }
    );
  }

  const { gameDirectory, blueprintName } = payload;
  const normalizedDirectory = gameSlug(gameDirectory);
  if (!normalizedDirectory) {
    return NextResponse.json(
      { error: "Invalid game directory" },
      { status: 400 }
    );
  }
  const editKey = extractEditKeyFromUrl(request);
  const accessResponse = await requireEditAccess(normalizedDirectory, editKey);
  if (accessResponse) {
    return accessResponse;
  }

  const slug = blueprintSlug(blueprintName || "blueprint");
  const blueprintDir = path.join(GAMES_ROOT, normalizedDirectory, "blueprints");
  const filePath = path.join(blueprintDir, `${slug}.ts`);
  try {
    await fs.access(filePath);
    return NextResponse.json({ ok: true, existed: true });
  } catch {
    try {
      await fs.mkdir(blueprintDir, { recursive: true });
      await fs.writeFile(filePath, blueprintTemplate());
      return NextResponse.json({ ok: true, existed: false });
    } catch (error) {
      console.warn("Blueprint create failed", error);
      return NextResponse.json(
        {
          error: "Failed to create blueprint file",
          details: getErrorMessage(error),
        },
        { status: 500 }
      );
    }
  }
}

export async function PUT(request: Request) {
  const payload = parsePayload(blueprintRenameSchema, await readJson(request));

  if (!payload) {
    return NextResponse.json(
      { error: "Invalid blueprint rename data" },
      { status: 400 }
    );
  }

  const { gameDirectory, previousName, nextName } = payload;
  const normalizedDirectory = gameSlug(gameDirectory);
  if (!normalizedDirectory) {
    return NextResponse.json(
      { error: "Invalid game directory" },
      { status: 400 }
    );
  }
  const editKey = extractEditKeyFromUrl(request);
  const accessResponse = await requireEditAccess(normalizedDirectory, editKey);
  if (accessResponse) {
    return accessResponse;
  }
  if (previousName === nextName) {
    return NextResponse.json({ ok: true, renamed: false, updatedGame: false });
  }

  const blueprintDir = path.join(GAMES_ROOT, normalizedDirectory, "blueprints");
  const prevSlug = blueprintSlug(previousName);
  const nextSlug = blueprintSlug(nextName);

  const fromPath = path.join(blueprintDir, `${prevSlug}.ts`);
  const toPath = path.join(blueprintDir, `${nextSlug}.ts`);
  try {
    await fs.mkdir(blueprintDir, { recursive: true });
    let renamed = false;
    if (prevSlug !== nextSlug) {
      await fs.rename(fromPath, toPath);
      renamed = true;
    }
    let updatedGame = false;
    try {
      updatedGame = await renameBlueprintInGameFile(
        normalizedDirectory,
        previousName,
        nextName
      );
    } catch (error) {
      if (renamed) {
        try {
          await fs.rename(toPath, fromPath);
        } catch (rollbackError) {
          console.warn("Failed to rollback blueprint rename", rollbackError);
        }
      }
      throw error;
    }
    return NextResponse.json({ ok: true, renamed, updatedGame });
  } catch (error) {
    console.warn("Blueprint rename failed", error);
    return NextResponse.json(
      {
        error: "Failed to rename blueprint file",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
