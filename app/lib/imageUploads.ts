import { DragEvent } from "react";
import { getEditKeyHeaders } from "@/lib/editKey";

const PNG_ONLY_ERROR = "Only PNG files are supported.";

export type PngDropResult = {
  file: File | null;
  error: string | null;
};

export function getDroppedPngFile(
  event: DragEvent<HTMLElement>
): PngDropResult {
  const [file] = Array.from(event.dataTransfer?.files ?? []);
  if (!file) {
    return { file: null, error: null };
  }
  if (!isPng(file)) {
    return { file: null, error: PNG_ONLY_ERROR };
  }
  return { file, error: null };
}

export async function uploadImageFile({
  gameDirectory,
  file,
  blueprintName,
  editKey,
}: {
  gameDirectory: string;
  file: File;
  blueprintName?: string;
  editKey?: string | null;
}): Promise<{ fileName: string; imagePath: string | null }> {
  const formData = new FormData();
  formData.append("gameDirectory", gameDirectory);
  if (blueprintName) {
    formData.append("blueprintName", blueprintName);
  }
  formData.append("file", file);
  const response = await fetch("/api/images", {
    method: "POST",
    body: formData,
    headers: getEditKeyHeaders(editKey),
  });

  const payload = (await response.json().catch(() => null)) as {
    fileName?: string;
    imagePath?: string;
    error?: string;
  } | null;

  if (!response.ok || !payload?.fileName) {
    throw new Error(payload?.error ?? "Failed to save image");
  }

  return { fileName: payload.fileName, imagePath: payload.imagePath ?? null };
}

export async function uploadBlueprintImage({
  gameDirectory,
  blueprintName,
  file,
  editKey,
}: {
  gameDirectory: string;
  blueprintName: string;
  file: File;
  editKey?: string | null;
}): Promise<string> {
  const { fileName } = await uploadImageFile({
    gameDirectory,
    blueprintName,
    file,
    editKey,
  });
  return fileName;
}

export async function uploadGameCoverImage({
  gameDirectory,
  file,
  editKey,
}: {
  gameDirectory: string;
  file: File;
  editKey?: string | null;
}): Promise<string> {
  const { fileName } = await uploadImageFile({
    gameDirectory,
    file,
    editKey,
  });

  const response = await fetch(
    `/api/game-settings/${encodeURIComponent(gameDirectory)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getEditKeyHeaders(editKey),
      },
      body: JSON.stringify({ image: fileName }),
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to save game cover image");
  }

  return fileName;
}

export async function loadImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to read image"));
      element.src = url;
    });
    return { width: image.width, height: image.height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isPng(file: File) {
  return (
    file.type === "image/png" ||
    file.name.toLowerCase().trim().endsWith(".png")
  );
}
