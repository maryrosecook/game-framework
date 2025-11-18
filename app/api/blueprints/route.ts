import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { blueprintSlug, blueprintTemplate } from "@/lib/blueprints";

const ROOT = process.cwd();

// Returns content of blueprint file
export async function POST(request: Request) {
  const { gameDirectory, blueprintName } = (await request.json()) as {
    gameDirectory: string;
    blueprintName: string;
  };

  if (!gameDirectory || !blueprintName) {
    return NextResponse.json(
      { error: "Invalid blueprint data" },
      { status: 400 }
    );
  }

  const slug = blueprintSlug(blueprintName || "blueprint");
  const blueprintDir = path.join(
    ROOT,
    "app",
    "games",
    gameDirectory,
    "blueprints"
  );
  const filePath = path.join(blueprintDir, `${slug}.ts`);
  try {
    await fs.access(filePath);
    return NextResponse.json({ ok: true, existed: true });
  } catch {
    await fs.mkdir(blueprintDir, { recursive: true });
    await fs.writeFile(filePath, blueprintTemplate(blueprintName));
    return NextResponse.json({ ok: true, existed: false });
  }
}

export async function PUT(request: Request) {
  const { gameDirectory, previousName, blueprintName } =
    (await request.json()) as {
      gameDirectory: string;
      previousName: string;
      blueprintName: string;
    };

  if (!gameDirectory || !previousName || !blueprintName) {
    return NextResponse.json(
      { error: "Invalid blueprint rename data" },
      { status: 400 }
    );
  }

  const blueprintDir = path.join(
    ROOT,
    "app",
    "games",
    gameDirectory,
    "blueprints"
  );
  const prevSlug = blueprintSlug(previousName);
  const nextSlug = blueprintSlug(blueprintName);
  if (prevSlug === nextSlug) {
    return NextResponse.json({ ok: true, renamed: false });
  }

  const fromPath = path.join(blueprintDir, `${prevSlug}.ts`);
  const toPath = path.join(blueprintDir, `${nextSlug}.ts`);
  try {
    await fs.mkdir(blueprintDir, { recursive: true });
    await fs.rename(fromPath, toPath);
    return NextResponse.json({ ok: true, renamed: true });
  } catch (error) {
    console.warn("Blueprint rename failed", error);
    return NextResponse.json(
      { error: "Failed to rename blueprint file" },
      { status: 500 }
    );
  }
}
