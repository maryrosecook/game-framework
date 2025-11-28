export function getBlueprintImageUrl(
  gameDirectory: string | undefined,
  imageName: string | undefined
): string | null {
  if (!gameDirectory || !imageName) {
    return null;
  }
  const trimmed = imageName.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }
  return `/api/images/${encodeURIComponent(
    gameDirectory
  )}/${encodeURIComponent(trimmed)}`;
}

export function getGameImageUrl(
  gameDirectory: string | undefined,
  imageName: string | null | undefined
): string | null {
  if (!gameDirectory || !imageName) {
    return null;
  }
  const trimmed = imageName.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }
  return `/api/images/${encodeURIComponent(
    gameDirectory
  )}/${encodeURIComponent(trimmed)}`;
}
