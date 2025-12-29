"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from "react";
import { PaintBucket, Pen } from "lucide-react";
import { getColorOptions } from "@/components/ColorGrid";
import type { GameEngine } from "@/engine/engine";
import {
  DEFAULT_IMAGE_SIZE,
  type EditableImageRecord,
} from "@/engine/editableImages";
import { Blueprint } from "@/engine/types";
import { getBlueprintImageUrl } from "@/lib/images";

const STORAGE_KEY = "bangui:draw:paint-colors";
const DISPLAY_PIXEL_SIZE = 14;
const DISPLAY_SIZE = DEFAULT_IMAGE_SIZE * DISPLAY_PIXEL_SIZE;
const CHECKER_SIZE = DISPLAY_PIXEL_SIZE / 2;

type DrawTabProps = {
  blueprint: Blueprint;
  gameDirectory: string;
  engine: GameEngine;
  imageVersion?: number;
};

type Pixel = { x: number; y: number };
type DrawTool = "pen" | "fill";
type PixelData = { data: Uint8ClampedArray; width: number; height: number };
type Rgba = { r: number; g: number; b: number; a: number };

type StoredColorMap = Record<string, string>;

export function DrawTab({
  blueprint,
  gameDirectory,
  engine,
  imageVersion,
}: DrawTabProps) {
  const palette = useMemo(() => getColorOptions(), []);
  const defaultColor = palette[0] ?? "#000000";
  const [selectedColor, setSelectedColor] = useState<string>(() =>
    getStoredColor(blueprint.name, defaultColor)
  );
  const [selectedTool, setSelectedTool] = useState<DrawTool>("pen");
  const [hoverPixel, setHoverPixel] = useState<Pixel | null>(null);
  const [fallbackImage, setFallbackImage] = useState<HTMLImageElement | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPixelRef = useRef<Pixel | null>(null);

  useEffect(() => {
    setSelectedColor(getStoredColor(blueprint.name, defaultColor));
    setHoverPixel(null);
    setImportError(null);
  }, [blueprint.name, defaultColor]);

  useEffect(() => {
    storeColor(blueprint.name, selectedColor);
  }, [blueprint.name, selectedColor]);

  useEffect(() => {
    let active = true;
    if (typeof Image === "undefined") {
      return;
    }
    if (!blueprint.image) {
      setFallbackImage(null);
      return () => {
        active = false;
      };
    }
    const record = engine.getEditableImageForBlueprint(blueprint.name);
    if (record) {
      setFallbackImage(null);
      return () => {
        active = false;
      };
    }
    const url = getBlueprintImageUrl(
      gameDirectory,
      blueprint.image,
      imageVersion
    );
    if (!url) {
      setFallbackImage(null);
      return () => {
        active = false;
      };
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (active) {
        setFallbackImage(image);
      }
    };
    image.onerror = () => {
      if (active) {
        setFallbackImage(null);
      }
    };
    image.src = url;
    return () => {
      active = false;
    };
  }, [blueprint.image, blueprint.name, engine, gameDirectory, imageVersion]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    drawCheckerboard(ctx, DISPLAY_SIZE, CHECKER_SIZE);

    const record = engine.getEditableImageForBlueprint(blueprint.name);
    const source = record?.canvas ?? fallbackImage;
    if (source) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
    }

    if (selectedTool === "fill") {
      const fillPixels = getFillHoverPixels({
        hoverPixel,
        selectedColor,
        record,
        fallbackImage,
        size: DEFAULT_IMAGE_SIZE,
      });
      drawHoverPixels(ctx, fillPixels, selectedColor, DISPLAY_PIXEL_SIZE);
    } else {
      drawHover(ctx, hoverPixel, selectedColor, DISPLAY_PIXEL_SIZE);
    }
    drawGrid(ctx, DEFAULT_IMAGE_SIZE, DISPLAY_PIXEL_SIZE);
  }, [
    blueprint.name,
    engine,
    fallbackImage,
    hoverPixel,
    selectedColor,
    selectedTool,
  ]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getPixelFromEvent = useCallback(
    (event: PointerEvent<HTMLCanvasElement>): Pixel | null => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
        return null;
      }
      const pixelSize = rect.width / DEFAULT_IMAGE_SIZE;
      const col = Math.floor(x / pixelSize);
      const row = Math.floor(y / pixelSize);
      if (
        col < 0 ||
        col >= DEFAULT_IMAGE_SIZE ||
        row < 0 ||
        row >= DEFAULT_IMAGE_SIZE
      ) {
        return null;
      }
      return { x: col, y: row };
    },
    []
  );

  const paintPixel = useCallback(
    (pixel: Pixel, previous: Pixel | null) => {
      const start = previous ?? pixel;
      engine.paintBlueprintLine(blueprint.name, start, pixel, selectedColor);
      renderCanvas();
    },
    [blueprint.name, engine, renderCanvas, selectedColor]
  );

  const fillPixels = useCallback(
    (pixel: Pixel) => {
      engine.paintBlueprintFill(blueprint.name, pixel, selectedColor);
      renderCanvas();
    },
    [blueprint.name, engine, renderCanvas, selectedColor]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) {
        return;
      }
      const pixel = getPixelFromEvent(event);
      if (!pixel) {
        return;
      }
      if (selectedTool === "fill") {
        fillPixels(pixel);
        setHoverPixel(pixel);
        return;
      }
      isDrawingRef.current = true;
      lastPixelRef.current = pixel;
      canvasRef.current?.setPointerCapture(event.pointerId);
      paintPixel(pixel, null);
      setHoverPixel(pixel);
    },
    [fillPixels, getPixelFromEvent, paintPixel, selectedTool]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const pixel = getPixelFromEvent(event);
      setHoverPixel(pixel);
      if (selectedTool !== "pen" || !isDrawingRef.current || !pixel) {
        return;
      }
      const previous = lastPixelRef.current;
      paintPixel(pixel, previous);
      lastPixelRef.current = pixel;
    },
    [getPixelFromEvent, paintPixel, selectedTool]
  );

  const stopDrawing = useCallback((event?: PointerEvent) => {
    if (event) {
      const canvas = canvasRef.current;
      if (canvas?.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }
    isDrawingRef.current = false;
    lastPixelRef.current = null;
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      stopDrawing(event);
    },
    [stopDrawing]
  );

  const handlePointerLeave = useCallback(() => {
    if (!isDrawingRef.current) {
      setHoverPixel(null);
    }
  }, []);

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      stopDrawing(event);
      setHoverPixel(null);
    },
    [stopDrawing]
  );

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setImportError("Please choose an image file.");
        return;
      }
      try {
        const image = await loadImageFromFile(file);
        if (
          image.width !== DEFAULT_IMAGE_SIZE ||
          image.height !== DEFAULT_IMAGE_SIZE
        ) {
          setImportError(
            `Image must be ${DEFAULT_IMAGE_SIZE}x${DEFAULT_IMAGE_SIZE} pixels.`
          );
          return;
        }
        const saved = engine.importBlueprintImage(blueprint.name, image);
        if (!saved) {
          setImportError("Failed to import image.");
          return;
        }
        setImportError(null);
        renderCanvas();
      } catch (error) {
        console.warn("Failed to import image", error);
        setImportError("Failed to load image.");
      }
    },
    [blueprint.name, engine, renderCanvas]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files.item(0);
      if (file) {
        void handleImportFile(file);
      }
    },
    [handleImportFile]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <div
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <canvas
            ref={canvasRef}
            width={DISPLAY_SIZE}
            height={DISPLAY_SIZE}
            className="block w-full h-auto cursor-crosshair touch-none"
            style={{ imageRendering: "pixelated" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerCancel}
          />
        </div>
      </div>

      <ToolBar selectedTool={selectedTool} onToolSelect={setSelectedTool} />

      {importError ? (
        <p className="text-xs text-red-600">{importError}</p>
      ) : null}

      <ColorPalette
        colors={palette}
        selectedColor={selectedColor}
        onColorSelect={setSelectedColor}
      />
    </div>
  );
}

function ToolBar({
  selectedTool,
  onToolSelect,
}: {
  selectedTool: DrawTool;
  onToolSelect: (tool: DrawTool) => void;
}) {
  return (
    <div className="flex gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <button
        type="button"
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold uppercase tracking-wide transition ${
          selectedTool === "pen"
            ? "border-2 border-blue-600 ring-2 ring-blue-300"
            : "border-slate-200 hover:border-slate-400"
        }`}
        onClick={() => onToolSelect("pen")}
        aria-pressed={selectedTool === "pen"}
        aria-label="Pen tool"
      >
        <Pen className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold uppercase tracking-wide transition ${
          selectedTool === "fill"
            ? "border-2 border-blue-600 ring-2 ring-blue-300"
            : "border-slate-200 hover:border-slate-400"
        }`}
        onClick={() => onToolSelect("fill")}
        aria-pressed={selectedTool === "fill"}
        aria-label="Paint can tool"
      >
        <PaintBucket className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function ColorPalette({
  colors,
  selectedColor,
  onColorSelect,
}: {
  colors: string[];
  selectedColor: string;
  onColorSelect: (color: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
        {colors.map((color) => {
          const isSelected = color === selectedColor;
          return (
            <button
              key={color}
              type="button"
              className={`relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border transition ${
                isSelected
                  ? "border-2 border-blue-600 ring-2 ring-blue-300"
                  : "border-slate-200 hover:border-slate-400"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => onColorSelect(color)}
              aria-label={`Select color ${color}`}
            >
            </button>
          );
        })}
        <button
          type="button"
          className={`relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border transition ${
            selectedColor === "transparent"
              ? "border-2 border-blue-600 ring-2 ring-blue-300"
              : "border-slate-200 hover:border-slate-400"
          }`}
          style={{ backgroundColor: "#e5e7eb" }}
          onClick={() => onColorSelect("transparent")}
          aria-label="Select eraser"
        >
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom right, transparent calc(50% - 1px), #374151 calc(50% - 1px), #374151 calc(50% + 1px), transparent calc(50% + 1px))",
            }}
          />
        </button>
      </div>
    </div>
  );
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  size: number,
  tile: number
) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#e2e8f0";
  for (let y = 0; y < size; y += tile) {
    for (let x = (y / tile) % 2 === 0 ? 0 : tile; x < size; x += tile * 2) {
      ctx.fillRect(x, y, tile, tile);
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  gridSize: number,
  pixelSize: number
) {
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
  ctx.lineWidth = 1;
  const max = gridSize * pixelSize;
  for (let i = 0; i <= gridSize; i += 1) {
    const pos =
      i === gridSize ? max - 0.5 : Math.round(i * pixelSize) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, max);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(max, pos);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHover(
  ctx: CanvasRenderingContext2D,
  hoverPixel: Pixel | null,
  color: string,
  pixelSize: number
) {
  if (!hoverPixel) {
    return;
  }
  drawHoverPixels(ctx, [hoverPixel], color, pixelSize);
}

function drawHoverPixels(
  ctx: CanvasRenderingContext2D,
  pixels: Pixel[],
  color: string,
  pixelSize: number
) {
  if (pixels.length === 0) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = color === "transparent" ? 0.6 : 0.5;
  ctx.fillStyle = color === "transparent" ? "#ffffff" : color;
  for (const pixel of pixels) {
    ctx.fillRect(
      pixel.x * pixelSize,
      pixel.y * pixelSize,
      pixelSize,
      pixelSize
    );
  }
  ctx.restore();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFillHoverPixels({
  hoverPixel,
  selectedColor,
  record,
  fallbackImage,
  size,
}: {
  hoverPixel: Pixel | null;
  selectedColor: string;
  record: EditableImageRecord | null;
  fallbackImage: HTMLImageElement | null;
  size: number;
}): Pixel[] {
  if (!hoverPixel) {
    return [];
  }
  const replacement = parseColorToRgba(selectedColor);
  if (!replacement) {
    return [];
  }
  const pixelData = getPreviewPixelData(record, fallbackImage, size);
  if (pixelData.width === 0 || pixelData.height === 0) {
    return [];
  }
  if (
    hoverPixel.x < 0 ||
    hoverPixel.y < 0 ||
    hoverPixel.x >= pixelData.width ||
    hoverPixel.y >= pixelData.height
  ) {
    return [];
  }
  const target = getRgbaAt(
    pixelData.data,
    hoverPixel.x,
    hoverPixel.y,
    pixelData.width
  );
  if (colorsMatch(target, replacement)) {
    return [];
  }
  return floodFillPixels(pixelData, hoverPixel, target);
}

function getPreviewPixelData(
  record: EditableImageRecord | null,
  fallbackImage: HTMLImageElement | null,
  size: number
): PixelData {
  if (record) {
    const fromCanvas = getPixelDataFromCanvas(record.canvas);
    if (fromCanvas) {
      return fromCanvas;
    }
  }
  if (fallbackImage) {
    const fromImage = getPixelDataFromImage(fallbackImage);
    if (fromImage) {
      return fromImage;
    }
  }
  return createBlankPixelData(size);
}

function getPixelDataFromCanvas(canvas: HTMLCanvasElement): PixelData | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
  };
}

function getPixelDataFromImage(image: HTMLImageElement): PixelData | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: imageData.data,
    width: imageData.width,
    height: imageData.height,
  };
}

function createBlankPixelData(size: number): PixelData {
  return {
    data: new Uint8ClampedArray(size * size * 4),
    width: size,
    height: size,
  };
}

function floodFillPixels(
  pixelData: PixelData,
  start: Pixel,
  target: Rgba
): Pixel[] {
  const { data, width, height } = pixelData;
  const visited = new Array<boolean>(width * height).fill(false);
  const queue: Pixel[] = [start];
  const result: Pixel[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      break;
    }
    const index = current.y * width + current.x;
    if (visited[index]) {
      continue;
    }
    visited[index] = true;
    const offset = index * 4;
    if (
      data[offset] !== target.r ||
      data[offset + 1] !== target.g ||
      data[offset + 2] !== target.b ||
      data[offset + 3] !== target.a
    ) {
      continue;
    }
    result.push(current);
    if (current.x > 0) {
      queue.push({ x: current.x - 1, y: current.y });
    }
    if (current.x < width - 1) {
      queue.push({ x: current.x + 1, y: current.y });
    }
    if (current.y > 0) {
      queue.push({ x: current.x, y: current.y - 1 });
    }
    if (current.y < height - 1) {
      queue.push({ x: current.x, y: current.y + 1 });
    }
  }

  return result;
}

function getRgbaAt(
  data: Uint8ClampedArray,
  x: number,
  y: number,
  width: number
): Rgba {
  const offset = (y * width + x) * 4;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3],
  };
}

function colorsMatch(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function parseColorToRgba(color: string): Rgba | null {
  const normalized = color.trim();
  if (normalized === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (!normalized.startsWith("#") || normalized.length !== 7) {
    return null;
  }
  const hex = normalized.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }
  return { r, g, b, a: 255 };
}

function loadStoredColors(): StoredColorMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {};
    }
    const entries = Object.entries(parsed);
    const colors: StoredColorMap = {};
    for (const [key, value] of entries) {
      if (typeof value === "string") {
        colors[key] = value;
      }
    }
    return colors;
  } catch {
    return {};
  }
}

function getStoredColor(blueprintName: string, fallback: string): string {
  const stored = loadStoredColors();
  return stored[blueprintName] ?? fallback;
}

function storeColor(blueprintName: string, color: string) {
  if (typeof window === "undefined") {
    return;
  }
  const stored = loadStoredColors();
  stored[blueprintName] = color;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage errors.
  }
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  if (typeof Image === "undefined") {
    throw new Error("Image APIs not available.");
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image."));
    };
    image.src = url;
  });
}
