"use client";

import { memo, RefObject } from "react";

type GameCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export const GameCanvas = memo(function GameCanvas({
  canvasRef,
}: GameCanvasProps) {
  return <canvas ref={canvasRef} className="h-full w-full touch-none" />;
});
