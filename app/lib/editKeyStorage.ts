import { isRecord } from "@/engine/types";

type StoredEditKey = {
  gameDirectory: string;
  editKey: string;
};

const STORAGE_KEY = "gameFrameworkEditKeys";

export function getStoredEditKeyForGame(gameDirectory: string): string | null {
  const normalizedGame = normalizeValue(gameDirectory);
  if (!normalizedGame) {
    return null;
  }
  const stored = readStoredEditKeys();
  const match = stored.find((entry) => entry.gameDirectory === normalizedGame);
  return match?.editKey ?? null;
}

export function storeEditKeyForGame(
  gameDirectory: string,
  editKey: string
): void {
  const normalizedGame = normalizeValue(gameDirectory);
  const normalizedKey = normalizeValue(editKey);
  if (!normalizedGame || !normalizedKey) {
    return;
  }
  const stored = readStoredEditKeys();
  const next = stored.filter(
    (entry) => entry.gameDirectory !== normalizedGame
  );
  next.push({ gameDirectory: normalizedGame, editKey: normalizedKey });
  writeStoredEditKeys(next);
}

function readStoredEditKeys(): StoredEditKey[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const entries: StoredEditKey[] = [];
    for (const entry of parsed) {
      if (!isStoredEditKey(entry)) {
        continue;
      }
      const normalizedGame = normalizeValue(entry.gameDirectory);
      const normalizedKey = normalizeValue(entry.editKey);
      if (!normalizedGame || !normalizedKey) {
        continue;
      }
      entries.push({ gameDirectory: normalizedGame, editKey: normalizedKey });
    }
    return entries;
  } catch {
    return [];
  }
}

function writeStoredEditKeys(entries: StoredEditKey[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors.
  }
}

function isStoredEditKey(value: unknown): value is StoredEditKey {
  return (
    isRecord(value) &&
    typeof value.gameDirectory === "string" &&
    typeof value.editKey === "string"
  );
}

function normalizeValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
