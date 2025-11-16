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

  const dragRef = useRef<{
    thingId: string;
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getWorldPoint(event, screen, camera, canvasRef);
    const hit = findTopThing(point, things ?? []);
    if (hit) {
      const offsetX = point.x - hit.x;
      const offsetY = point.y - hit.y;
      dragRef.current = {
        thingId: hit.id,
        offsetX,
        offsetY,
        pointerId: event.pointerId,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      engine.dispatch({
        type: "setSelectedThingId",
        thingId: hit.id,
      });
      onSelectBlueprint?.(hit.blueprintName);
    } else {
      engine.dispatch({ type: "setSelectedThingId", thingId: null });
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) {
      return;
    }
    const point = getWorldPoint(event, screen, camera, canvasRef);
    const { thingId, offsetX, offsetY } = dragRef.current;
    engine.dispatch({
      type: "setThingProperties",
      thingId,
      properties: {
        x: point.x - offsetX,
        y: point.y - offsetY,
      },
    });
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
