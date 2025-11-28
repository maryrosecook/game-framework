"use client";

import { DragEvent, memo, PointerEvent, RefObject, useRef } from "react";
import { GameEngine } from "@/engine/engine";
import { Blueprint, RuntimeGameState, RuntimeThing } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { createThingFromBlueprint } from "@/engine/blueprints";
import { createThingId } from "@/lib/id";
import { createBlueprint, getNextBlueprintName } from "@/lib/blueprints";
import { getDroppedPngFile, uploadBlueprintImage } from "@/lib/imageUploads";
import { getColorOptions } from "@/components/ColorGrid";

const BLUEPRINT_MIME = "application/x-blueprint";
const IMPORTED_BLUEPRINT_SIZE = 100;

type DragTarget = { thingId: string; offsetX: number; offsetY: number };

type GameCanvasProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  subscribe: GameSubscribe;
  engine: GameEngine;
  gameDirectory: string;
  onSelectBlueprint?: (name: string) => void;
};

export const GameCanvas = memo(function GameCanvas({
  canvasRef,
  subscribe,
  engine,
  gameDirectory,
  onSelectBlueprint,
}: GameCanvasProps) {
  const [things] = subscribe<RuntimeThing[]>(["things"]);
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [screen] = subscribe<RuntimeGameState["screen"]>(["screen"]);
  const [camera] = subscribe<RuntimeGameState["camera"]>(["camera"]);
  const [selectedThingIds] = subscribe<string[]>(["selectedThingIds"]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);

  const dragRef = useRef<{
    mode: "move" | "resize";
    pointerId: number;
    targets?: DragTarget[];
    thingId?: string;
    anchor?: { x: number; y: number };
    angle?: number;
    editingIds: string[];
  } | null>(null);
  const importingRef = useRef(false);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getWorldPoint(event, screen, camera, canvasRef);

    const primarySelectedThing = (things ?? []).find(
      (thing) => thing.id === selectedThingId
    );
    if (primarySelectedThing && isOnResizeHandle(point, primarySelectedThing)) {
      const anchor = getResizeAnchor(primarySelectedThing);
      const editingIds = [primarySelectedThing.id];
      engine.beginEditingThings(editingIds);
      dragRef.current = {
        mode: "resize",
        thingId: primarySelectedThing.id,
        pointerId: event.pointerId,
        anchor,
        angle: primarySelectedThing.angle,
        editingIds,
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

    const currentThings = things ?? [];
    const hit = findTopThing(point, currentThings, getBlueprintZ);
    if (hit) {
      const nextSelected = nextSelectedIdsForClick(
        selectedThingIds,
        hit.id,
        event.shiftKey
      );

      if (!nextSelected.includes(hit.id)) {
        engine.dispatch({
          type: "setSelectedThingIds",
          thingIds: nextSelected,
        });
        return;
      }

      const targets = buildDragTargets(nextSelected, currentThings, point);
      if (targets.length === 0) {
        engine.dispatch({
          type: "setSelectedThingIds",
          thingIds: nextSelected,
        });
        return;
      }

      if (event.altKey) {
        const duplicateTargets = duplicateDragTargets(
          targets,
          currentThings,
          engine
        );
        if (duplicateTargets) {
          const duplicateIds = duplicateTargets.targets.map(
            (target) => target.thingId
          );
          engine.dispatch({
            type: "setSelectedThingIds",
            thingIds: duplicateIds,
          });
          onSelectBlueprint?.(hit.blueprintName);
          engine.beginEditingThings(duplicateIds);
          dragRef.current = {
            mode: "move",
            targets: duplicateTargets.targets,
            pointerId: event.pointerId,
            editingIds: duplicateIds,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          return;
        }
      }

      engine.dispatch({
        type: "setSelectedThingIds",
        thingIds: nextSelected,
      });

      onSelectBlueprint?.(hit.blueprintName);

      const editingIds = targets.map((target) => target.thingId);
      engine.beginEditingThings(editingIds);
      dragRef.current = {
        mode: "move",
        targets,
        pointerId: event.pointerId,
        editingIds,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      engine.dispatch({ type: "setSelectedThingIds", thingIds: [] });
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) {
      return;
    }
    if (dragRef.current.pointerId !== event.pointerId) {
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
    if (dragRef.current?.pointerId === event.pointerId) {
      if (dragRef.current.editingIds.length > 0) {
        engine.endEditingThings(dragRef.current.editingIds);
      }
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.editingIds.length) {
      engine.endEditingThings(dragRef.current.editingIds);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handlePointerCancel = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.editingIds.length) {
      engine.endEditingThings(dragRef.current.editingIds);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const handleDragOver = (event: DragEvent<HTMLCanvasElement>) => {
    if (event.dataTransfer?.types?.includes("Files")) {
      event.dataTransfer.dropEffect = "copy";
    }
    event.preventDefault();
  };

  const handleDrop = async (event: DragEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const dropPoint = getWorldPoint(event, screen, camera, canvasRef);

    const { file, error } = getDroppedPngFile(event);
    if (error) {
      window.alert(error);
      return;
    }
    if (file) {
      await handleImageDrop(file, dropPoint);
      return;
    }

    const blueprintName =
      event.dataTransfer.getData(BLUEPRINT_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (!blueprintName) return;
    const blueprint = (blueprints ?? []).find(
      (bp) => bp.name === blueprintName
    );
    if (!blueprint) return;
    const thing = createThingFromBlueprint(blueprint, dropPoint);
    engine.dispatch({ type: "addThing", thing });
    engine.dispatch({ type: "setSelectedThingId", thingId: thing.id });
    onSelectBlueprint?.(thing.blueprintName);
  };

  const handleImageDrop = async (
    file: File,
    dropPoint: { x: number; y: number }
  ) => {
    if (importingRef.current) {
      return;
    }
    importingRef.current = true;
    try {
      const existingBlueprints = blueprints ?? [];
      const blueprintName = getNextBlueprintName(
        existingBlueprints,
        file.name.replace(/\.[^.]+$/, "")
      );
      const imageName = await uploadBlueprintImage({
        gameDirectory,
        blueprintName,
        file,
      });
      const colors = getColorOptions();
      const color =
        colors[existingBlueprints.length % colors.length] ?? "#888888";
      const width = IMPORTED_BLUEPRINT_SIZE;
      const height = IMPORTED_BLUEPRINT_SIZE;
      const blueprint = createBlueprint({
        name: blueprintName,
        color,
        image: imageName,
        width,
        height,
      });
      const thing = createThingFromBlueprint(blueprint, dropPoint);
      engine.dispatch({ type: "addBlueprint", blueprint });
      engine.dispatch({ type: "addThing", thing });
      engine.dispatch({ type: "setSelectedThingId", thingId: thing.id });
      onSelectBlueprint?.(blueprint.name);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import image";
      window.alert(message);
    } finally {
      importingRef.current = false;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
  const targets: DragTarget[] = [];
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

function duplicateDragTargets(
  targets: DragTarget[],
  things: RuntimeThing[],
  engine: GameEngine
) {
  const thingLookup = new Map(things.map((thing) => [thing.id, thing]));
  const duplicates: { thing: RuntimeThing; target: DragTarget }[] = [];

  for (const target of targets) {
    const original = thingLookup.get(target.thingId);
    if (!original) continue;
    const clone: RuntimeThing = {
      ...original,
      id: createThingId(),
      velocityX: 0,
      velocityY: 0,
    };
    duplicates.push({
      thing: clone,
      target: { ...target, thingId: clone.id },
    });
  }

  if (duplicates.length === 0) {
    return null;
  }

  for (const duplicate of duplicates) {
    engine.dispatch({ type: "addThing", thing: duplicate.thing });
  }

  return {
    targets: duplicates.map((entry) => entry.target),
  };
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
