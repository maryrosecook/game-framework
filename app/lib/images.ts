export function getBlueprintImageUrl(
  gameDirectory: string | undefined,
  imageName: string | undefined,
  version?: number
): string | null {
  if (!gameDirectory || !imageName) {
    return null;
  }
  const trimmed = imageName.trim();
  if (!trimmed || trimmed.includes("/") || trimmed.includes("\\")) {
    return null;
  }
  const base = `/api/images/${encodeURIComponent(
    gameDirectory
  )}/${encodeURIComponent(trimmed)}`;
  const cacheBuster =
    typeof version === "number" && Number.isFinite(version) && version > 0
      ? `?v=${version}`
      : "";
  return `${base}${cacheBuster}`;
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
