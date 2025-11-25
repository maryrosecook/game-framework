import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { blueprintSlug } from "@/lib/blueprints";
import { gameSlug } from "@/lib/games";

const ROOT = process.cwd();

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.warn("Failed to parse form data", error);
    return NextResponse.json(
      { error: "Invalid upload payload" },
      { status: 400 }
    );
  }

  const gameDirectory = formData.get("gameDirectory");
  const blueprintName = formData.get("blueprintName");
  const file = formData.get("file");

  if (typeof gameDirectory !== "string" || !isBlobLike(file)) {
    return NextResponse.json(
      { error: "Provide a game directory and PNG file" },
      { status: 400 }
    );
  }

  const normalizedDirectory = gameSlug(gameDirectory);
  if (!normalizedDirectory) {
    return NextResponse.json(
      { error: "Invalid game directory" },
      { status: 400 }
    );
  }

  const extension = path.extname(getFileName(file)).toLowerCase();
  const type = getFileType(file);
  if (type !== "image/png" && extension !== ".png") {
    return NextResponse.json(
      { error: "Only PNG files are supported" },
      { status: 400 }
    );
  }

  const baseName =
    typeof blueprintName === "string" && blueprintName.trim().length > 0
      ? blueprintSlug(blueprintName)
      : blueprintSlug(path.basename(getFileName(file), extension)) || "image";
  const fileName = `${baseName}-${Date.now()}.png`;
  const imagesDir = path.join(
    ROOT,
    "app",
    "games",
    normalizedDirectory,
    "images"
  );
  const filePath = path.join(imagesDir, fileName);

  try {
    await fs.mkdir(imagesDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);
  } catch (error) {
    console.warn("Failed to save blueprint image", error);
    return NextResponse.json(
      { error: "Failed to save image" },
      { status: 500 }
    );
  }

  const imagePath = `/api/images/${encodeURIComponent(
    normalizedDirectory
  )}/${encodeURIComponent(fileName)}`;
  return NextResponse.json({ ok: true, fileName, imagePath });
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function"
  );
}

function getFileName(file: Blob) {
  if ("name" in file && typeof (file as { name?: unknown }).name === "string") {
    return (file as { name: string }).name;
  }
  return "image.png";
}

function getFileType(file: Blob) {
  return typeof (file as { type?: unknown }).type === "string"
    ? (file as { type: string }).type
    : "";
}
