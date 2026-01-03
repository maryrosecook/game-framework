import "server-only";

import { NextResponse } from "next/server";
import { validateEditKey } from "@/lib/games";

export async function requireEditAccess(
  gameDirectory: string,
  editKey: string | null
) {
  const canEdit = await validateEditKey(gameDirectory, editKey);
  if (canEdit) {
    return null;
  }
  return NextResponse.json(
    { error: "Edit access required" },
    { status: 403 }
  );
}
