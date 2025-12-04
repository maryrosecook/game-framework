"use client";

import { memo, RefObject } from "react";
import { PointerMode } from "@/engine/input/pointer";

type GameCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  pointerMode: PointerMode;
};

export const GameCanvas = memo(function GameCanvas({
  canvasRef,
  pointerMode,
}: GameCanvasProps) {
  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full touch-none ${pointerMode === "paint" ? "cursor-crosshair" : "cursor-default"}`}
    />
  );
});
