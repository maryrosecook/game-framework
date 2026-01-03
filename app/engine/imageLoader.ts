import { getBlueprintImageUrl, getPrimaryImageName } from "@/lib/images";
import { Blueprint } from "./types";

export async function loadBlueprintImages(
  gameDirectory: string,
  blueprints: Blueprint[]
): Promise<Map<string, CanvasImageSource>> {
  const sources = uniqueSources(gameDirectory, blueprints);
  return loadImages(sources);
}

export async function loadImages(
  sources: string[]
): Promise<Map<string, CanvasImageSource>> {
  if (sources.length === 0 || typeof Image === "undefined") {
    return new Map();
  }

  const pairs = await Promise.all(
    sources.map(async (src) => {
      try {
        const image = await loadImage(src);
        return [src, image] as [string, CanvasImageSource];
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
    const imageName = getPrimaryImageName(blueprint.images);
    const src = getBlueprintImageUrl(gameDirectory, imageName);
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
