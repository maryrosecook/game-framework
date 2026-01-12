import "server-only";

import { validateEditKey } from "@/lib/games";

export async function canEditGame(
  request: Request | null,
  gameDirectory: string,
  editKey: string | null
): Promise<boolean> {
  if (request && isLocalhostRequest(request)) {
    return true;
  }
  return validateEditKey(gameDirectory, editKey);
}

function isLocalhostRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname.trim().toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}
