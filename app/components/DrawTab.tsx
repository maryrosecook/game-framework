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
import { getColorOptions } from "@/components/ColorGrid";
import type { GameEngine } from "@/engine/engine";
import { DEFAULT_IMAGE_SIZE } from "@/engine/editableImages";
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

    drawHover(ctx, hoverPixel, selectedColor, DISPLAY_PIXEL_SIZE);
    drawGrid(ctx, DEFAULT_IMAGE_SIZE, DISPLAY_PIXEL_SIZE);
  }, [blueprint.name, engine, fallbackImage, hoverPixel, selectedColor]);

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

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) {
        return;
      }
      const pixel = getPixelFromEvent(event);
      if (!pixel) {
        return;
      }
      isDrawingRef.current = true;
      lastPixelRef.current = pixel;
      canvasRef.current?.setPointerCapture(event.pointerId);
      paintPixel(pixel, null);
      setHoverPixel(pixel);
    },
    [getPixelFromEvent, paintPixel]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const pixel = getPixelFromEvent(event);
      setHoverPixel(pixel);
      if (!isDrawingRef.current || !pixel) {
        return;
      }
      const previous = lastPixelRef.current;
      paintPixel(pixel, previous);
      lastPixelRef.current = pixel;
    },
    [getPixelFromEvent, paintPixel]
  );

  const stopDrawing = useCallback((event?: PointerEvent) => {
    if (event) {
      canvasRef.current?.releasePointerCapture(event.pointerId);
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
  ctx.save();
  ctx.globalAlpha = color === "transparent" ? 0.6 : 0.5;
  ctx.fillStyle = color === "transparent" ? "#ffffff" : color;
  ctx.fillRect(
    hoverPixel.x * pixelSize,
    hoverPixel.y * pixelSize,
    pixelSize,
    pixelSize
  );
  ctx.restore();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
