"use client";

import { DragEvent, memo, RefObject, useRef } from "react";
import { GameEngine } from "@/engine/engine";
import { Blueprint, RuntimeGameState } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { createThingFromBlueprint } from "@/engine/blueprints";
import { createBlueprint, getNextBlueprintName } from "@/lib/blueprints";
import { getDroppedPngFile, uploadBlueprintImage } from "@/lib/imageUploads";
import { getColorOptions } from "@/components/ColorGrid";

const BLUEPRINT_MIME = "application/x-blueprint";
const IMPORTED_BLUEPRINT_SIZE = 100;

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
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [screen] = subscribe<RuntimeGameState["screen"]>(["screen"]);
  const [camera] = subscribe<RuntimeGameState["camera"]>(["camera"]);

  const importingRef = useRef(false);

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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="h-full w-full touch-none"
    />
  );
});

function getWorldPoint(
  event: DragEvent<HTMLCanvasElement>,
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
