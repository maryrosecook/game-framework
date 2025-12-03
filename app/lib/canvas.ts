import { DragEvent, RefObject } from "react";
import { RuntimeGameState } from "@/engine/types";

export function getWorldPointFromEvent({
  event,
  screen,
  camera,
  canvasRef,
}: {
  event: DragEvent<HTMLElement>;
  screen: RuntimeGameState["screen"];
  camera: RuntimeGameState["camera"];
  canvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const offsetX = (rect.width - screen.width) / 2;
  const offsetY = (rect.height - screen.height) / 2;
  return {
    x: x - offsetX + camera.x,
    y: y - offsetY + camera.y,
  };
}
