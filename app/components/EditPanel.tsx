import { useState } from "react";
import { Blueprint, RawThing } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { BlueprintTab } from "@/components/BlueprintTab";
import { DrawTab } from "@/components/DrawTab";
import { ActionTab } from "@/components/ActionTab";
import { TabButton } from "@/components/TabButton";
import type { GameEngine } from "@/engine/engine";
import { getPrimaryImageName } from "@/lib/images";

type PanelTab = "blueprint" | "draw" | "action";

export function EditPanel({
  blueprintName,
  subscribe,
  onRename,
  engine,
  gameDirectory,
  imageVersions,
  onClone,
  canClone,
  onCreate,
}: {
  blueprintName: string;
  subscribe: GameSubscribe;
  onRename: (next: string) => void;
  engine: GameEngine;
  gameDirectory: string;
  imageVersions: Record<string, number>;
  onClone: () => void;
  canClone: boolean;
  onCreate: () => void;
}) {
  const [blueprints] = subscribe<Blueprint[] | undefined>(["blueprints"]);
  const [things] = subscribe<RawThing[]>(["things"]);
  const [blueprint, dispatchGame] = subscribe<Blueprint | undefined>([
    "blueprints",
    blueprintName,
  ]);
  const [selectedThingId] = subscribe<string | null>(["selectedThingId"]);
  const [activeTab, setActiveTab] = useState<PanelTab>("blueprint");

  if (!blueprint) {
    return null;
  }

  const primaryImage = getPrimaryImageName(blueprint.images);
  const imageVersion = primaryImage ? imageVersions[primaryImage] : undefined;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 bottom-4 z-10 flex w-[25.35rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
        <TabButton
          label="Blueprint"
          isActive={activeTab === "blueprint"}
          onSelect={() => setActiveTab("blueprint")}
        />
        <TabButton
          label="Draw"
          isActive={activeTab === "draw"}
          onSelect={() => setActiveTab("draw")}
        />
        <TabButton
          label="Action"
          isActive={activeTab === "action"}
          onSelect={() => setActiveTab("action")}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "blueprint" ? (
          <BlueprintTab
            blueprint={blueprint}
            things={things ?? []}
            selectedThingId={selectedThingId}
            dispatch={dispatchGame}
            gameDirectory={gameDirectory}
            imageVersion={imageVersion}
            onRename={onRename}
            onClone={onClone}
            canClone={canClone}
            onCreate={onCreate}
          />
        ) : activeTab === "draw" ? (
          <DrawTab
            blueprint={blueprint}
            gameDirectory={gameDirectory}
            engine={engine}
            imageVersion={imageVersion}
          />
        ) : (
          <ActionTab
            blueprint={blueprint}
            blueprints={blueprints ?? []}
            dispatch={dispatchGame}
          />
        )}
      </div>
    </div>
  );
}
