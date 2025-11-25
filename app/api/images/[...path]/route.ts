import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gameSlug, isNotFoundError } from "@/lib/games";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ path?: string | string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const rawPath = (await context.params).path;
  const segments = Array.isArray(rawPath)
    ? rawPath
    : rawPath
      ? [rawPath]
      : [];
  if (segments.length !== 2) {
    return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
  }
  const [rawGameDirectory, fileName] = segments;
  const gameDirectory = gameSlug(rawGameDirectory ?? "");
  if (!gameDirectory || !fileName) {
    return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
  }

  if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return NextResponse.json({ error: "Invalid image name" }, { status: 400 });
  }

  const filePath = path.join(
    process.cwd(),
    "app",
    "games",
    gameDirectory,
    "images",
    fileName
  );

  try {
    const buffer = await fs.readFile(filePath);
    const headers = new Headers({
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    });
    return new NextResponse(buffer, { headers });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.warn("Failed to load blueprint image", error);
    return NextResponse.json(
      { error: "Failed to load image" },
      { status: 500 }
    );
  }
}
