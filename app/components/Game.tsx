"use client";

import { useEffect, useRef, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Toolbar } from "@/components/Toolbar";
import { BlueprintPanel } from "@/components/BlueprintPanel";
import { useGame } from "@/engine/useGame";
import { Blueprint, RawThing } from "@/engine/types";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { createBlueprint } from "@/lib/blueprints";
import { getColorOptions } from "@/components/ColorGrid";
import { normalizeName } from "@/engine/reducer";

type GameProps = {
  gameDirectory: string;
};

export function Game({ gameDirectory }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isPaused, subscribe, engine } = useGame(canvasRef, gameDirectory);
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [things] = subscribe<RawThing[]>(["things"]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);
  const [selectedThingIds] = subscribe<string[]>(["selectedThingIds"]);
  const [activeBlueprintName, setActiveBlueprintName] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!blueprints || blueprints.length === 0) {
      setActiveBlueprintName(null);
      return;
    }
    if (
      !activeBlueprintName ||
      !blueprints.find(
        (bp) =>
          normalizeName(bp.name) ===
          normalizeName(activeBlueprintName ?? blueprints[0].name)
      )
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

  useKeyboardShortcuts({ engine, isPaused, selectedThingIds });

  const handleSelectBlueprint = (name: string) => {
    setActiveBlueprintName(name);
    engine.dispatch({ type: "setSelectedThingId", thingId: null });
  };

  const handleAddBlueprint = () => {
    if (!isPaused) return;
    const name = getNextBlueprintName(blueprints ?? []);
    const index = blueprints?.length ?? 0;
    const colors = getColorOptions();
    const color = colors[index % colors.length];
    const newBlueprint: Blueprint = createBlueprint({ name, color });
    engine.dispatch({ type: "addBlueprint", blueprint: newBlueprint });
    setActiveBlueprintName(newBlueprint.name);
  };

  const handleTogglePause = () => {
    engine.dispatch({ type: "setPaused", isPaused: !isPaused });
  };

  return (
    <div className="relative h-full min-h-screen w-full overflow-hidden bg-white text-slate-900">
      <GameCanvas
        canvasRef={canvasRef}
        subscribe={subscribe}
        engine={engine}
        onSelectBlueprint={setActiveBlueprintName}
      />
      {activeBlueprintName ? (
        <BlueprintPanel
          blueprintName={activeBlueprintName}
          subscribe={subscribe}
          engine={engine}
          onRename={setActiveBlueprintName}
        />
      ) : null}
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 flex justify-center px-6 pb-4">
        <Toolbar
          blueprints={blueprints ?? []}
          selectedBlueprintName={activeBlueprintName}
          onSelectBlueprint={handleSelectBlueprint}
          onAddBlueprint={handleAddBlueprint}
          onTogglePause={handleTogglePause}
          isPaused={isPaused}
        />
      </div>
    </div>
  );
}


function getNextBlueprintName(blueprints: Blueprint[]) {
  const existing = new Set(blueprints.map((bp) => normalizeName(bp.name)));
  let counter = blueprints.length + 1;
  let candidate = `Blueprint ${counter}`;
  while (existing.has(normalizeName(candidate))) {
    counter += 1;
    candidate = `Blueprint ${counter}`;
  }
  return candidate;
}
