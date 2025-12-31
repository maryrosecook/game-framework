import { RuntimeThing, Vector } from "../../types";
import { createThingStack, findTopmostInStack } from "../../thingStacking";

const RESIZE_HANDLE_SIZE = 12;

export function hitTestThing(point: Vector, thing: RuntimeThing) {
  return (
    point.x >= thing.x &&
    point.x <= thing.x + thing.width &&
    point.y >= thing.y &&
    point.y <= thing.y + thing.height
  );
}

export function hitTestResizeHandle(point: Vector, thing: RuntimeThing) {
  const local = worldToLocal(point, thing);
  return (
    local.x >= thing.width - RESIZE_HANDLE_SIZE &&
    local.x <= thing.width &&
    local.y >= thing.height - RESIZE_HANDLE_SIZE &&
    local.y <= thing.height
  );
}

export function findTopThingAtPoint(
  point: Vector,
  things: RuntimeThing[]
) {
  const stack = createThingStack(things);
  return findTopmostInStack(stack, (thing) => hitTestThing(point, thing));
}

export function getWorldPointFromClient({
  canvas,
  clientX,
  clientY,
  camera,
}: {
  canvas: HTMLCanvasElement | null;
  clientX: number;
  clientY: number;
  camera: Vector;
}): Vector | null {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  return {
    x: x + camera.x,
    y: y + camera.y,
  };
}

export function getResizeAnchor(thing: RuntimeThing) {
  const center = getThingCenter(thing);
  const offset = rotatePoint(
    { x: -thing.width / 2, y: -thing.height / 2 },
    (thing.angle * Math.PI) / 180
  );
  return { x: center.x + offset.x, y: center.y + offset.y };
}

export function rotatePoint(point: Vector, angleRad: number) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function worldToLocal(point: Vector, thing: RuntimeThing) {
  const anchor = getResizeAnchor(thing);
  const delta = { x: point.x - anchor.x, y: point.y - anchor.y };
  const rotated = rotatePoint(delta, (-thing.angle * Math.PI) / 180);
  return { x: rotated.x, y: rotated.y };
}

function getThingCenter(thing: RuntimeThing) {
  return { x: thing.x + thing.width / 2, y: thing.y + thing.height / 2 };
}
