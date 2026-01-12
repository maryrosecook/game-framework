import "server-only";

import { validateEditKey } from "@/lib/games";

export async function canEditGame(
  request: Request | null,
  gameDirectory: string,
  editKey: string | null
): Promise<boolean> {
  return validateEditKey(gameDirectory, editKey);
}
