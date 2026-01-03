"use client";

import { DragEvent, PropsWithChildren, RefObject, useRef } from "react";
import { GameEngine } from "@/engine/engine";
import { Blueprint, RuntimeGameState } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { getColorOptions, getRandomColorOption } from "@/components/ColorGrid";
import { createBlueprint, getNextBlueprintName } from "@/lib/blueprints";
import { getWorldPointFromEvent } from "@/lib/canvas";
import { getDroppedPngFile, uploadBlueprintImage } from "@/lib/imageUploads";
import { createThingFromBlueprint } from "@/engine/blueprints";

const BLUEPRINT_MIME = "application/x-blueprint";

const IMPORTED_BLUEPRINT_SIZE = 100;

type DragAndDropProps = PropsWithChildren<{
  canvasRef: RefObject<HTMLCanvasElement | null>;
  subscribe: GameSubscribe;
  engine: GameEngine;
  gameDirectory: string;
  onSelectBlueprint?: (name: string) => void;
  isReadOnly?: boolean;
  editKey?: string | null;
}>;

export function DragAndDrop({
  canvasRef,
  subscribe,
  engine,
  gameDirectory,
  onSelectBlueprint,
  isReadOnly = false,
  editKey,
  children,
}: DragAndDropProps) {
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [camera] = subscribe<RuntimeGameState["camera"]>(["camera"]);

  const importingRef = useRef(false);

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (isReadOnly) {
      return;
    }
    const isFile = event.dataTransfer?.types?.includes("Files");
    const isBlueprint =
      event.dataTransfer?.types?.includes(BLUEPRINT_MIME) ||
      event.dataTransfer?.types?.includes("text/plain");
    if (!isFile && !isBlueprint) {
      return;
    }
    event.dataTransfer.dropEffect = "copy";
    event.preventDefault();
  };

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    if (isReadOnly) {
      return;
    }
    const blueprintName =
      event.dataTransfer.getData(BLUEPRINT_MIME) ||
      event.dataTransfer.getData("text/plain");
    if (blueprintName) {
      event.preventDefault();
      const dropPoint = getWorldPointFromEvent({
        event,
        camera,
        canvasRef,
      });
      handleBlueprintDrop(blueprintName, dropPoint);
      return;
    }

    const { file, error } = getDroppedPngFile(event);

    if (file || error) {
      event.preventDefault();
      if (error) {
        window.alert(error);
        return;
      }
      if (!file) {
        return;
      }
      const dropPoint = getWorldPointFromEvent({
        event,
        camera,
        canvasRef,
      });
      await handleImageDrop(file, dropPoint);
    }
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
        editKey,
      });
      const colors = getColorOptions();
      const color = getRandomColorOption(colors);
      const width = IMPORTED_BLUEPRINT_SIZE;
      const height = IMPORTED_BLUEPRINT_SIZE;
      const blueprint = createBlueprint({
        name: blueprintName,
        color,
        images: [imageName],
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

  const handleBlueprintDrop = (
    blueprintName: string,
    dropPoint: { x: number; y: number }
  ) => {
    const blueprint = (blueprints ?? []).find(
      (candidate) => candidate.name === blueprintName
    );
    if (!blueprint) return;
    const thing = createThingFromBlueprint(blueprint, dropPoint);
    engine.dispatch({ type: "addThing", thing });
    engine.dispatch({ type: "setSelectedThingId", thingId: thing.id });
    onSelectBlueprint?.(thing.blueprintName);
  };

  return (
    <div
      className="h-full w-full"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {children}
    </div>
  );
}
