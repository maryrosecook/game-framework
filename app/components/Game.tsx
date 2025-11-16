"use client";

import { useEffect, useRef, useState } from "react";
import { GameCanvas } from "@/components/GameCanvas";
import { Toolbar } from "@/components/Toolbar";
import { useGame, GameSubscribe } from "@/engine/useGame";
import { Blueprint, Thing } from "@/engine/types";
import { GameEngine } from "@/engine/engine";

const COLOR_OPTIONS = [
  "#b399ff",
  "#99b3ff",
  "#99d6ff",
  "#ffcc99",
  "#ff9966",
  "#99e6cc",
  "#66cc99",
  "#ffb3cc",
  "#ff6699",
  "#f5f5f5",
  "#d9d9d9",
  "#b3b3b3",
  "#4d4d4d",
];

export function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isPaused, subscribe, engine } = useGame(canvasRef);
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [things] = subscribe<Thing[]>(["things"]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);
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
          normalize(bp.name) ===
          normalize(activeBlueprintName ?? blueprints[0].name)
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

  const handleSelectBlueprint = (name: string) => {
    setActiveBlueprintName(name);
    engine.dispatch({ type: "setSelectedThingId", thingId: null });
  };

  const handleAddBlueprint = async () => {
    const name = getNextBlueprintName(blueprints ?? []);
    const index = blueprints?.length ?? 0;
    const color = COLOR_OPTIONS[index % COLOR_OPTIONS.length];
    const newBlueprint: Blueprint = {
      name,
      width: 50,
      height: 50,
      z: 1,
      color,
    };
    engine.dispatch({ type: "addBlueprint", blueprint: newBlueprint });
    setActiveBlueprintName(newBlueprint.name);
    const gameDirectory = engine.getGameDirectory();
    if (!gameDirectory) {
      return;
    }
    try {
      await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameDirectory,
          blueprintName: newBlueprint.name,
        }),
      });
    } catch (error) {
      console.warn("Failed to scaffold blueprint file", error);
    }
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

function BlueprintPanel({
  blueprintName,
  subscribe,
  engine,
  onRename,
}: {
  blueprintName: string;
  subscribe: GameSubscribe;
  engine: GameEngine;
  onRename: (next: string) => void;
}) {
  const [blueprint, dispatchBlueprint] = subscribe<Blueprint | undefined>([
    "blueprints",
    blueprintName,
  ]);

  if (!blueprint) {
    return null;
  }

  const updateField = (property: keyof Blueprint, value: string | number) => {
    dispatchBlueprint({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property,
      value,
    });
  };

  const handleRename = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === blueprint.name) {
      return;
    }
    const previousName = blueprint.name;
    updateField("name", trimmed);
    const things = (engine.getStateAtPath(["things"]) as Thing[]) ?? [];
    for (const thing of things) {
      if (normalize(thing.blueprintName) === normalize(blueprint.name)) {
        engine.dispatch({
          type: "setThingProperty",
          thingId: thing.id,
          property: "blueprintName",
          value: trimmed,
        });
      }
    }
    const gameDirectory = engine.getGameDirectory();
    if (gameDirectory) {
      try {
        await fetch("/api/blueprints", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameDirectory,
            previousName,
            blueprintName: trimmed,
          }),
        });
      } catch (error) {
        console.warn("Failed to rename blueprint file", error);
      }
    }
    onRename(trimmed);
  };

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Blueprint
        </p>
        <input
          key={blueprint.name}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
          defaultValue={blueprint.name}
          onBlur={(event) => {
            void handleRename(event.target.value);
          }}
        />
      </header>
      <div className="space-y-3">
        <Field
          label="Z"
          value={blueprint.z}
          onChange={(value) => updateField("z", value)}
        />
        <ColorGrid
          selected={blueprint.color}
          onSelect={(color) => updateField("color", color)}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
      {label}
      <input
        type="number"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

function ColorGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          className={`size-6 cursor-pointer rounded-full border transition ${
            selected === color
              ? "border-slate-500 ring-2 ring-slate-200"
              : "border-slate-200 hover:border-slate-400"
          }`}
          style={{ backgroundColor: color }}
          onClick={() => onSelect(color)}
        />
      ))}
    </div>
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getNextBlueprintName(blueprints: Blueprint[]) {
  const existing = new Set(blueprints.map((bp) => normalize(bp.name)));
  let counter = blueprints.length + 1;
  let candidate = `Blueprint ${counter}`;
  while (existing.has(normalize(candidate))) {
    counter += 1;
    candidate = `Blueprint ${counter}`;
  }
  return candidate;
}
