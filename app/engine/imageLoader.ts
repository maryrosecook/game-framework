import { getBlueprintImageUrl } from "@/lib/images";
import {
  imageColorToTransparent,
  WHITE_THRESHOLD,
} from "./imageColorToTransparent";
import { Blueprint } from "./types";

type LoadOptions = {
  threshold?: number;
};

export function renderWithTransparentWhite(
  image: HTMLImageElement,
  threshold: number
): CanvasImageSource | null {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width === 0 || height === 0) {
    return null;
  }

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context =
    canvas instanceof OffscreenCanvas
      ? canvas.getContext("2d")
      : canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const [processed] = imageColorToTransparent(
    [context.getImageData(0, 0, width, height)],
    { threshold }
  );
  context.putImageData(processed, 0, 0);
  return canvas;
}

export async function loadBlueprintImages(
  gameDirectory: string,
  blueprints: Blueprint[],
  options: LoadOptions = {}
): Promise<Map<string, CanvasImageSource>> {
  const sources = uniqueSources(gameDirectory, blueprints);
  return loadImages(sources, options);
}

export async function loadImages(
  sources: string[],
  options: LoadOptions = {}
): Promise<Map<string, CanvasImageSource>> {
  if (sources.length === 0 || typeof Image === "undefined") {
    return new Map();
  }

  const threshold = options.threshold ?? WHITE_THRESHOLD;
  const pairs = await Promise.all(
    sources.map(async (src) => {
      try {
        const image = await loadImage(src);
        const processed = renderWithTransparentWhite(image, threshold);
        return processed ? [src, processed] : null;
      } catch (error) {
        console.warn("Failed to load blueprint image", error);
        return null;
      }
    })
  );

  const entries = pairs.filter(
    (pair): pair is [string, CanvasImageSource] => pair !== null
  );
  return new Map(entries);
}

function uniqueSources(gameDirectory: string, blueprints: Blueprint[]) {
  const sources = new Set<string>();
  for (const blueprint of blueprints) {
    const src = getBlueprintImageUrl(gameDirectory, blueprint.image);
    if (src) {
      sources.add(src);
    }
  }
  return [...sources];
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
