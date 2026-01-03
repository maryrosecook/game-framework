export function extractEditKeyFromUrl(request: Request): string | null {
  const url = new URL(request.url);
  const edit = url.searchParams.get("edit");
  if (!edit) {
    return null;
  }
  const trimmed = edit.trim();
  return trimmed.length > 0 ? trimmed : null;
}
