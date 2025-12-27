"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from "react";
import { Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const handleClear = useCallback(() => {
    engine.clearBlueprintImage(blueprint.name);
    renderCanvas();
  }, [blueprint.name, engine, renderCanvas]);

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

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.item(0);
      if (file) {
        void handleImportFile(file);
      }
      if (event.target.value) {
        event.target.value = "";
      }
    },
    [handleImportFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingFile(false);
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
      setIsDraggingFile(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDraggingFile(false);
    },
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
          <span>Selected color</span>
          <ColorSwatch color={selectedColor} />
        </div>
        <div
          className={`rounded-xl border border-slate-200 bg-white p-2 shadow-inner ${
            isDraggingFile ? "ring-2 ring-blue-300 ring-offset-1" : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <canvas
            ref={canvasRef}
            width={DISPLAY_SIZE}
            height={DISPLAY_SIZE}
            className="block cursor-crosshair touch-none"
            style={{ imageRendering: "pixelated" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerCancel}
          />
        </div>
        <p className="text-[10px] text-slate-400">
          16x16 pixels. Click and drag to draw.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          Import 16x16
        </Button>
        <Button type="button" variant="outline" onClick={handleClear}>
          <RotateCcw className="size-4" />
          Clear
        </Button>
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
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Color palette
      </p>
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <button
          type="button"
          className={`group relative h-10 w-10 overflow-hidden rounded-lg border transition ${
            selectedColor === "transparent"
              ? "border-slate-500 ring-2 ring-slate-300"
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

        {colors.map((color) => {
          const isSelected = color === selectedColor;
          return (
            <button
              key={color}
              type="button"
              className={`group relative h-10 w-10 overflow-hidden rounded-lg border transition ${
                isSelected
                  ? "border-slate-500 ring-2 ring-slate-300"
                  : "border-slate-200 hover:border-slate-400"
              }`}
              style={{ backgroundColor: color }}
              onClick={() => onColorSelect(color)}
              aria-label={`Select color ${color}`}
            >
              {!isSelected ? (
                <span
                  className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-50"
                  style={{ backgroundColor: selectedColor }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 text-center">
        {colors.length} colors + eraser
      </p>
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-4 w-4 overflow-hidden rounded border border-slate-300">
      {color === "transparent" ? (
        <span
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
            backgroundSize: "6px 6px",
            backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
            backgroundColor: "#ffffff",
          }}
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
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
  for (let i = 0; i <= gridSize; i += 1) {
    const pos = Math.round(i * pixelSize) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, gridSize * pixelSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(gridSize * pixelSize, pos);
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
