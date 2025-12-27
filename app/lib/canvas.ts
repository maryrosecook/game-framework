import { DragEvent, RefObject } from "react";
import { RuntimeGameState } from "@/engine/types";

export function getWorldPointFromEvent({
  event,
  camera,
  canvasRef,
}: {
  event: DragEvent<HTMLElement>;
  camera: RuntimeGameState["camera"];
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return {
    x: x + camera.x,
    y: y + camera.y,
  };
}
