"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Toolbar } from "@/components/Toolbar";
import { EditPanel } from "@/components/EditPanel";
import { GameCanvas } from "@/components/GameCanvas";
import { DragAndDrop } from "@/components/DragAndDrop";
import { useGame } from "@/engine/useGame";
import { Blueprint, RawThing, RuntimeGameState, Vector } from "@/engine/types";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { createBlueprint, getNextBlueprintName } from "@/lib/blueprints";
import { getColorOptions, getRandomColorOption } from "@/components/ColorGrid";
import { createThingFromBlueprint } from "@/engine/blueprints";

type GameProps = {
  gameDirectory: string;
};

export function Game({ gameDirectory }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { subscribe, engine } = useGame(canvasRef, gameDirectory);
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [things] = subscribe<RawThing[]>(["things"]);
  const [camera] = subscribe<RuntimeGameState["camera"]>(["camera"]);
  const [screen] = subscribe<RuntimeGameState["screen"]>(["screen"]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);
  const [selectedThingIds] = subscribe<string[]>(["selectedThingIds"]);
  const [activeBlueprintName, setActiveBlueprintName] = useState<string | null>(
    null
  );
  const palette = useMemo(() => getColorOptions(), []);
  const [imageVersions, setImageVersions] = useState<Record<string, number>>(
    {}
  );

  useEffect(() => {
    if (!blueprints || blueprints.length === 0) {
      setActiveBlueprintName(null);
      return;
    }
    if (
      !activeBlueprintName ||
      !blueprints.find((bp) => bp.name === activeBlueprintName)
    ) {
      setActiveBlueprintName(blueprints[0].name);
    }
  }, [activeBlueprintName, blueprints]);

  useEffect(() => {
    if (!selectedThingId) {
      return;
    }
    const target = things?.find((thing) => thing.id === selectedThingId);
    if (target) {
      setActiveBlueprintName(target.blueprintName);
    }
  }, [selectedThingId, things]);

  useEffect(() => {
    setImageVersions({});
  }, [gameDirectory]);

  useEffect(() => {
    return engine.subscribeImageUpdates(({ fileName }) => {
      setImageVersions((previous) => ({
        ...previous,
        [fileName]: (previous[fileName] ?? 0) + 1,
      }));
    });
  }, [engine]);

  useKeyboardShortcuts({ engine, selectedThingIds });

  const handleSelectBlueprint = (name: string) => {
    setActiveBlueprintName(name);
    engine.dispatch({ type: "setSelectedThingId", thingId: null });
  };

  const handleAddBlueprint = () => {
    const name = getNextBlueprintName(blueprints ?? []);
    const color = getRandomColorOption(palette);
    const newBlueprint: Blueprint = createBlueprint({ name, color });
    engine.dispatch({ type: "addBlueprint", blueprint: newBlueprint });
    setActiveBlueprintName(newBlueprint.name);
  };

  const handleCloneSelection = () => {
    if (selectedThingIds.length === 0) {
      return;
    }
    const worldPoint = getSelectionWorldPoint(
      selectedThingIds,
      things ?? [],
      selectedThingId
    );
    if (!worldPoint) {
      return;
    }
    const duplicateIds = engine.duplicateThingsWithIds(
      selectedThingIds,
      worldPoint
    );
    if (duplicateIds.length === 0) {
      return;
    }
    engine.dispatch({ type: "setSelectedThingIds", thingIds: duplicateIds });
  };

  const handleCreateThing = () => {
    if (!activeBlueprintName) {
      return;
    }
    const blueprint = (blueprints ?? []).find(
      (candidate) => candidate.name === activeBlueprintName
    );
    if (!blueprint) {
      return;
    }
    const worldPoint = {
      x: camera.x + screen.width / 2,
      y: camera.y + screen.height / 2,
    };
    const thing = createThingFromBlueprint(blueprint, worldPoint);
    engine.dispatch({ type: "addThing", thing });
    engine.dispatch({ type: "setSelectedThingId", thingId: thing.id });
  };

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-white text-slate-900">
      <DragAndDrop
        canvasRef={canvasRef}
        subscribe={subscribe}
        engine={engine}
        gameDirectory={gameDirectory}
        onSelectBlueprint={setActiveBlueprintName}
      >
        <GameCanvas canvasRef={canvasRef} />
      </DragAndDrop>
      {activeBlueprintName ? (
        <EditPanel
          blueprintName={activeBlueprintName}
          subscribe={subscribe}
          onRename={setActiveBlueprintName}
          engine={engine}
          gameDirectory={gameDirectory}
          imageVersions={imageVersions}
          onClone={handleCloneSelection}
          canClone={selectedThingIds.length > 0}
          onCreate={handleCreateThing}
        />
      ) : null}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center px-6 pb-4">
        <div className="pointer-events-auto">
          <Toolbar
            blueprints={blueprints ?? []}
            selectedBlueprintName={activeBlueprintName}
            onSelectBlueprint={handleSelectBlueprint}
            onAddBlueprint={handleAddBlueprint}
            gameDirectory={gameDirectory}
            imageVersions={imageVersions}
            subscribe={subscribe}
          />
        </div>
      </div>
    </div>
  );
}

function getSelectionWorldPoint(
  selectedIds: string[],
  things: RawThing[],
  primaryId: string | null
): Vector | null {
  if (primaryId) {
    const primary = things.find((thing) => thing.id === primaryId);
    if (primary) {
      return { x: primary.x, y: primary.y };
    }
  }
  let totalX = 0;
  let totalY = 0;
  let count = 0;
  const lookup = new Map(things.map((thing) => [thing.id, thing]));
  for (const id of selectedIds) {
    const thing = lookup.get(id);
    if (!thing) {
      continue;
    }
    totalX += thing.x;
    totalY += thing.y;
    count += 1;
  }
  if (count === 0) {
    return null;
  }
  return { x: totalX / count, y: totalY / count };
}
