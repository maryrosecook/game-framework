export const EDIT_KEY_HEADER = "x-game-edit-key";

export function extractEditKeyFromRequest(request: Request): string | null {
  return normalizeEditKey(request.headers.get(EDIT_KEY_HEADER));
}

export function getEditKeyHeaders(
  editKey: string | null | undefined
): Record<string, string> {
  const normalized = normalizeEditKey(editKey);
  if (!normalized) {
    return {};
  }
  return { [EDIT_KEY_HEADER]: normalized };
}

export function normalizeEditKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
