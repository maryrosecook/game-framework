"use client";

import { DragEvent, memo, PointerEvent, RefObject, useRef } from "react";
import { GameEngine } from "@/engine/engine";
import { Blueprint, RuntimeGameState, RuntimeThing } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { createThingFromBlueprint } from "@/engine/blueprints";

const BLUEPRINT_MIME = "application/x-blueprint";

type GameCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  subscribe: GameSubscribe;
  engine: GameEngine;
  onSelectBlueprint?: (name: string) => void;
};

export const GameCanvas = memo(function GameCanvas({
  canvasRef,
  subscribe,
  engine,
  onSelectBlueprint,
}: GameCanvasProps) {
  const [things] = subscribe<RuntimeThing[]>(["things"]);
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [screen] = subscribe<RuntimeGameState["screen"]>(["screen"]);
  const [camera] = subscribe<RuntimeGameState["camera"]>(["camera"]);
  const [selectedThingIds] = subscribe<string[]>(["selectedThingIds"]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);
  const [isPaused] = subscribe<boolean>(["isPaused"]);

  const dragRef = useRef<{
    mode: "move" | "resize";
    pointerId: number;
    targets?: { thingId: string; offsetX: number; offsetY: number }[];
    thingId?: string;
    anchor?: { x: number; y: number };
    angle?: number;
  } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isPaused) return;
    const point = getWorldPoint(event, screen, camera, canvasRef);

    const primarySelectedThing = (things ?? []).find(
      (thing) => thing.id === selectedThingId
    );
    if (primarySelectedThing && isOnResizeHandle(point, primarySelectedThing)) {
      const anchor = getResizeAnchor(primarySelectedThing);
      dragRef.current = {
        mode: "resize",
        thingId: primarySelectedThing.id,
        pointerId: event.pointerId,
        anchor,
        angle: primarySelectedThing.angle,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const getBlueprintZ = (blueprintName: string) => {
      const blueprint = (blueprints ?? []).find(
        (bp) => bp.name === blueprintName
      );
      return blueprint?.z ?? 1;
    };

    const hit = findTopThing(point, things ?? [], getBlueprintZ);
    if (hit) {
      const nextSelected = nextSelectedIdsForClick(
        selectedThingIds,
        hit.id,
        event.shiftKey
      );

      engine.dispatch({
        type: "setSelectedThingIds",
        thingIds: nextSelected,
      });

      if (nextSelected.includes(hit.id)) {
        onSelectBlueprint?.(hit.blueprintName);
        const targets = buildDragTargets(nextSelected, things ?? [], point);

        if (targets.length > 0) {
          dragRef.current = {
            mode: "move",
            targets,
            pointerId: event.pointerId,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }
    } else {
      engine.dispatch({ type: "setSelectedThingIds", thingIds: [] });
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) {
      return;
    }
    if (!isPaused) {
      dragRef.current = null;
      return;
    }
    if (dragRef.current.mode === "move" && dragRef.current.targets) {
      const point = getWorldPoint(event, screen, camera, canvasRef);
      for (const target of dragRef.current.targets) {
        engine.dispatch({
          type: "setThingProperties",
          thingId: target.thingId,
          properties: {
            x: point.x - target.offsetX,
            y: point.y - target.offsetY,
          },
        });
      }
      return;
    }

    if (dragRef.current.mode === "resize" && dragRef.current.thingId) {
      const point = getWorldPoint(event, screen, camera, canvasRef);
      const activeThing = engine.getStateAtPath([
        "things",
        dragRef.current.thingId,
      ]);
      if (!isThing(activeThing)) {
        return;
      }
      const anchor = dragRef.current.anchor ?? getResizeAnchor(activeThing);
      const angle = dragRef.current.angle ?? activeThing.angle;

      const angleRad = (angle * Math.PI) / 180;
      const delta = {
        x: point.x - anchor.x,
        y: point.y - anchor.y,
      };
      const rotated = rotatePoint(delta, -angleRad);
      const width = Math.max(10, rotated.x);
      const height = Math.max(10, rotated.y);

      const centerOffset = rotatePoint(
        { x: width / 2, y: height / 2 },
        angleRad
      );
      const center = {
        x: anchor.x + centerOffset.x,
        y: anchor.y + centerOffset.y,
      };

      engine.dispatch({
        type: "setThingProperties",
        thingId: activeThing.id,
        properties: {
          width,
          height,
          x: center.x - width / 2,
          y: center.y - height / 2,
        },
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isPaused) return;
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = () => {
    dragRef.current = null;
  };

  const handleDragOver = (event: DragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!isPaused) return;
    const blueprintName =
      event.dataTransfer.getData(BLUEPRINT_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!blueprintName) return;
    const blueprint = (blueprints ?? []).find(
      (bp) => bp.name === blueprintName
    );
    if (!blueprint) return;
    const point = getWorldPoint(event, screen, camera, canvasRef);
    const thing = createThingFromBlueprint(blueprint, point);
    engine.dispatch({ type: "addThing", thing });
    engine.dispatch({ type: "setSelectedThingId", thingId: thing.id });
    onSelectBlueprint?.(thing.blueprintName);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="h-full w-full touch-none"
    />
  );
});

function getWorldPoint(
  event: PointerEvent<HTMLCanvasElement> | DragEvent<HTMLCanvasElement>,
  screen: { width: number; height: number },
  camera: { x: number; y: number },
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
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

function findTopThing(
  point: { x: number; y: number },
  things: RuntimeThing[],
  getBlueprintZ: (blueprintName: string) => number
) {
  const sorted = [...things].sort(
    (a, b) => getBlueprintZ(b.blueprintName) - getBlueprintZ(a.blueprintName)
  );
  return sorted.find(
    (thing) =>
      point.x >= thing.x &&
      point.x <= thing.x + thing.width &&
      point.y >= thing.y &&
      point.y <= thing.y + thing.height
  );
}

function isOnResizeHandle(
  point: { x: number; y: number },
  thing: RuntimeThing
) {
  const handleSize = 12;
  const local = worldToLocal(point, thing);
  return (
    local.x >= thing.width - handleSize &&
    local.x <= thing.width &&
    local.y >= thing.height - handleSize &&
    local.y <= thing.height
  );
}

function buildDragTargets(
  selectedIds: string[],
  things: RuntimeThing[],
  point: { x: number; y: number }
) {
  const targets: { thingId: string; offsetX: number; offsetY: number }[] = [];
  for (const id of selectedIds) {
    const target = things.find((thing) => thing.id === id);
    if (!target) continue;
    targets.push({
      thingId: id,
      offsetX: point.x - target.x,
      offsetY: point.y - target.y,
    });
  }
  return targets;
}

function toggleThingSelection(selectedIds: string[], id: string) {
  return selectedIds.includes(id)
    ? selectedIds.filter((current) => current !== id)
    : [...selectedIds, id];
}

function nextSelectedIdsForClick(
  currentIds: string[],
  hitId: string,
  addToExisting: boolean
) {
  if (addToExisting) {
    return toggleThingSelection(currentIds, hitId);
  }
  if (currentIds.includes(hitId)) {
    return currentIds;
  }
  return [hitId];
}

function isThing(candidate: unknown): candidate is RuntimeThing {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const value = candidate as Record<string, unknown>;
  return (
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number" &&
    typeof value.velocityX === "number" &&
    typeof value.velocityY === "number"
  );
}

function getResizeAnchor(thing: RuntimeThing) {
  const center = getThingCenter(thing);
  const offset = rotatePoint(
    { x: -thing.width / 2, y: -thing.height / 2 },
    (thing.angle * Math.PI) / 180
  );
  return { x: center.x + offset.x, y: center.y + offset.y };
}

function worldToLocal(point: { x: number; y: number }, thing: RuntimeThing) {
  const anchor = getResizeAnchor(thing);
  const delta = { x: point.x - anchor.x, y: point.y - anchor.y };
  const rotated = rotatePoint(delta, (-thing.angle * Math.PI) / 180);
  return { x: rotated.x, y: rotated.y };
}

function rotatePoint(point: { x: number; y: number }, angleRad: number) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function getThingCenter(thing: RuntimeThing) {
  return { x: thing.x + thing.width / 2, y: thing.y + thing.height / 2 };
}
