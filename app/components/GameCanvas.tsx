"use client";

import { DragEvent, memo, PointerEvent, RefObject, useRef } from "react";
import { GameEngine } from "@/engine/engine";
import { Blueprint, GameState, Thing } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { createThingId } from "@/lib/id";

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
  const [things] = subscribe<Thing[]>(["things"]);
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [screen] = subscribe<GameState["screen"]>(["screen"]);
  const [camera] = subscribe<GameState["camera"]>(["camera"]);
  const [selectedThingIds] = subscribe<string[]>(["selectedThingIds"]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);

  const dragRef = useRef<{
    mode: "move" | "resize";
    pointerId: number;
    targets?: { thingId: string; offsetX: number; offsetY: number }[];
    thingId?: string;
  } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getWorldPoint(event, screen, camera, canvasRef);

    const primarySelectedThing = (things ?? []).find(
      (thing) => thing.id === selectedThingId
    );
    if (primarySelectedThing && isOnResizeHandle(point, primarySelectedThing)) {
      dragRef.current = {
        mode: "resize",
        thingId: primarySelectedThing.id,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const hit = findTopThing(point, things ?? []);
    if (hit) {
      const isSelected = selectedThingIds.includes(hit.id);
      const nextSelected = event.shiftKey
        ? toggleThingSelection(selectedThingIds, hit.id)
        : isSelected
          ? selectedThingIds
          : [hit.id];

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
      const width = Math.max(10, point.x - activeThing.x);
      const height = Math.max(10, point.y - activeThing.y);
      engine.dispatch({
        type: "setThingProperties",
        thingId: activeThing.id,
        properties: {
          width,
          height,
          inherits: {
            ...activeThing.inherits,
            width: false,
            height: false,
          },
        },
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
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
    const blueprintName =
      event.dataTransfer.getData(BLUEPRINT_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!blueprintName) return;
    const blueprint = (blueprints ?? []).find(
      (bp) => normalizeBlueprint(bp.name) === normalizeBlueprint(blueprintName)
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

function findTopThing(point: { x: number; y: number }, things: Thing[]) {
  const sorted = [...things].sort((a, b) => b.z - a.z);
  return sorted.find(
    (thing) =>
      point.x >= thing.x &&
      point.x <= thing.x + thing.width &&
      point.y >= thing.y &&
      point.y <= thing.y + thing.height
  );
}

function isOnResizeHandle(point: { x: number; y: number }, thing: Thing) {
  const handleSize = 12;
  return (
    point.x >= thing.x + thing.width - handleSize &&
    point.x <= thing.x + thing.width &&
    point.y >= thing.y + thing.height - handleSize &&
    point.y <= thing.y + thing.height
  );
}

function buildDragTargets(
  selectedIds: string[],
  things: Thing[],
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

function isThing(candidate: unknown): candidate is Thing {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const value = candidate as Record<string, unknown>;
  return (
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.width === "number" &&
    typeof value.height === "number"
  );
}

function createThingFromBlueprint(
  blueprint: Blueprint,
  point: { x: number; y: number }
): Thing {
  return {
    id: createThingId(),
    x: point.x - blueprint.width / 2,
    y: point.y - blueprint.height / 2,
    z: blueprint.z,
    width: blueprint.width,
    height: blueprint.height,
    angle: 0,
    velocity: { x: 0, y: 0 },
    physicsType: "dynamic",
    blueprintName: blueprint.name,
    inherits: {
      width: true,
      height: true,
      z: true,
      color: true,
    },
  };
}

function normalizeBlueprint(value: string) {
  return value.trim().toLowerCase();
}
