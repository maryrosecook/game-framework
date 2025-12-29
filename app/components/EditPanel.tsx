import { useState } from "react";
import { Blueprint } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { BlueprintTab } from "@/components/BlueprintTab";
import { DrawTab } from "@/components/DrawTab";
import { TabButton } from "@/components/TabButton";
import type { GameEngine } from "@/engine/engine";

type PanelTab = "blueprint" | "draw";

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
  const [blueprint, dispatchGame] = subscribe<Blueprint | undefined>([
    "blueprints",
    blueprintName,
  ]);
  const [activeTab, setActiveTab] = useState<PanelTab>("blueprint");

  if (!blueprint) {
    return null;
  }

  const imageVersion = blueprint.image
    ? imageVersions[blueprint.image]
    : undefined;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 flex w-78 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
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
      </div>

      {activeTab === "blueprint" ? (
        <BlueprintTab
          blueprint={blueprint}
          blueprints={blueprints ?? []}
          dispatch={dispatchGame}
          gameDirectory={gameDirectory}
          imageVersion={imageVersion}
          onRename={onRename}
          onClone={onClone}
          canClone={canClone}
          onCreate={onCreate}
        />
      ) : (
        <DrawTab
          blueprint={blueprint}
          gameDirectory={gameDirectory}
          engine={engine}
          imageVersion={imageVersion}
        />
      )}
    </div>
  );
}
