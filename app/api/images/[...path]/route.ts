import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { gameSlug } from "@/lib/games";
import { isNotFoundError } from "@/engine/types";
import { getErrorMessage } from "@/lib/errors";

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
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
    return new NextResponse(arrayBuffer, { headers });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.warn("Failed to load blueprint image", error);
    return NextResponse.json(
      { error: "Failed to load image", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
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

  if (!fileName.toLowerCase().endsWith(".png")) {
    return NextResponse.json({ error: "Only PNG images are supported" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("image/png")) {
    return NextResponse.json({ error: "Image must be sent as image/png" }, { status: 400 });
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
    const buffer = Buffer.from(await request.arrayBuffer());
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("Failed to save painted image", error);
    return NextResponse.json(
      { error: "Failed to save image", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
