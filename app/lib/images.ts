export function normalizeImageFileName(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("..")
  ) {
    return null;
  }
  return trimmed;
}

export function getBlueprintImageUrl(
  gameDirectory: string | undefined,
  imageName: string | undefined,
  version?: number
): string | null {
  const normalized = normalizeImageFileName(imageName);
  if (!gameDirectory || !normalized) {
    return null;
  }
  const base = `/api/images/${encodeURIComponent(
    gameDirectory
  )}/${encodeURIComponent(normalized)}`;
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
  const normalized = normalizeImageFileName(imageName);
  if (!gameDirectory || !normalized) {
    return null;
  }
  return `/api/images/${encodeURIComponent(
    gameDirectory
  )}/${encodeURIComponent(normalized)}`;
}
