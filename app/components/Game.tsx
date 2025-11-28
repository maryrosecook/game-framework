"use client";

import { useEffect, useRef, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Toolbar } from "@/components/Toolbar";
import { EditPanel } from "@/components/EditPanel";
import { useGame } from "@/engine/useGame";
import { Blueprint, RawThing } from "@/engine/types";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { createBlueprint } from "@/lib/blueprints";
import { getColorOptions } from "@/components/ColorGrid";

type GameProps = {
  gameDirectory: string;
};

export function Game({ gameDirectory }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { subscribe, engine } = useGame(canvasRef, gameDirectory);
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

  useKeyboardShortcuts({ engine, selectedThingIds });

  const handleSelectBlueprint = (name: string) => {
    setActiveBlueprintName(name);
    engine.dispatch({ type: "setSelectedThingId", thingId: null });
  };

  const handleAddBlueprint = () => {
    const name = getNextBlueprintName(blueprints ?? []);
    const index = blueprints?.length ?? 0;
    const colors = getColorOptions();
    const color = colors[index % colors.length];
    const newBlueprint: Blueprint = createBlueprint({ name, color });
    engine.dispatch({ type: "addBlueprint", blueprint: newBlueprint });
    setActiveBlueprintName(newBlueprint.name);
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
        <EditPanel
          blueprintName={activeBlueprintName}
          subscribe={subscribe}
          onRename={setActiveBlueprintName}
          gameDirectory={gameDirectory}
        />
      ) : null}
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0 flex justify-center px-6 pb-4">
        <Toolbar
          blueprints={blueprints ?? []}
          selectedBlueprintName={activeBlueprintName}
          onSelectBlueprint={handleSelectBlueprint}
          onAddBlueprint={handleAddBlueprint}
          gameDirectory={gameDirectory}
        />
      </div>
    </div>
  );
}


function getNextBlueprintName(blueprints: Blueprint[]) {
  const existing = new Set(blueprints.map((bp) => bp.name));
  let counter = blueprints.length + 1;
  let candidate = `blueprint-${counter}`;
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `blueprint-${counter}`;
  }
  return candidate;
}
