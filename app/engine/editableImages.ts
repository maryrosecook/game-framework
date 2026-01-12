export const DEFAULT_IMAGE_SIZE = 16;

export type EditableImageRecord = {
  src: string;
  fileName: string;
  canvas: HTMLCanvasElement;
};

export type PersistEditableImageOptions = {
  headers?: HeadersInit;
};

export type PersistEditableImage = (
  record: EditableImageRecord,
  options?: PersistEditableImageOptions
) => Promise<boolean>;

export class EditableImageStore {
  constructor(
    private readonly onPersist?: (record: EditableImageRecord) => void,
    private readonly persistImage: PersistEditableImage = persistEditableImage
  ) {}

  private records = new Map<string, EditableImageRecord>();
  private dirtySources = new Set<string>();
  private persistHandle: number | null = null;

  reset() {
    this.records.clear();
    this.dirtySources.clear();
    if (this.persistHandle) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
  }

  getRecord(src: string) {
    return this.records.get(src);
  }

  createBlank(src: string, fileName: string): EditableImageRecord | null {
    const record = createBlankImageRecord(src, fileName, DEFAULT_IMAGE_SIZE);
    if (!record) return null;
    this.records.set(src, record);
    return record;
  }

  remove(src: string) {
    this.records.delete(src);
    this.dirtySources.delete(src);
  }

  wrapSource(
    src: string,
    fileName: string,
    source: CanvasImageSource
  ): EditableImageRecord | null {
    const record = createRecordFromSource(
      src,
      fileName,
      source,
      DEFAULT_IMAGE_SIZE
    );
    if (!record) return null;
    this.records.set(src, record);
    return record;
  }

  markDirty(record: EditableImageRecord) {
    this.dirtySources.add(record.src);
    if (this.persistHandle || typeof window === "undefined") {
      return;
    }
    this.persistHandle = window.setTimeout(() => {
      this.persistHandle = null;
      void this.flush();
    }, 150);
  }

  private async flush() {
    const sources = [...this.dirtySources];
    this.dirtySources.clear();
    for (const src of sources) {
      const record = this.records.get(src);
      if (!record) continue;
      const persisted = await this.persistImage(record);
      if (persisted) {
        try {
          this.onPersist?.(record);
        } catch (error) {
          console.warn("Image persist listener failed", error);
        }
      }
    }
  }
}

export function createBlankImageRecord(
  src: string,
  fileName: string,
  size: number = DEFAULT_IMAGE_SIZE
): EditableImageRecord | null {
  const canvas = createCanvas(size, size);
  if (!canvas) return null;
  return { src, fileName, canvas };
}

export function createRecordFromSource(
  src: string,
  fileName: string,
  source: CanvasImageSource,
  size: number = DEFAULT_IMAGE_SIZE
): EditableImageRecord | null {
  const canvas = createCanvas(size, size);
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  try {
    ctx.drawImage(source, 0, 0, size, size);
  } catch (error) {
    console.warn("Failed to copy image into editable canvas", error);
    return null;
  }
  return { src, fileName, canvas };
}

export async function persistEditableImage(
  record: EditableImageRecord,
  options: PersistEditableImageOptions = {}
): Promise<boolean> {
  const blob = await canvasToBlob(record.canvas);
  if (!blob) return false;
  try {
    const headers = new Headers(options.headers ?? {});
    headers.set("Content-Type", "image/png");
    const response = await fetch(record.src, {
      method: "PUT",
      headers,
      body: blob,
    });
    if (!response.ok) {
      console.warn("Failed to save painted image", record.fileName);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Failed to persist painted image", error);
    return false;
  }
}

export function extractFileName(src: string): string {
  const segments = src.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? decodeURIComponent(last) : "";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function createCanvas(width: number, height: number) {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}
