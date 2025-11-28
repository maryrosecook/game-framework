import { useState } from "react";
import { Blueprint } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { BlueprintTab } from "@/components/BlueprintTab";
import { SettingsTab } from "@/components/SettingsTab";
import { TabButton } from "@/components/TabButton";

type PanelTab = "blueprint" | "settings";

export function EditPanel({
  blueprintName,
  subscribe,
  onRename,
  gameDirectory,
}: {
  blueprintName: string;
  subscribe: GameSubscribe;
  onRename: (next: string) => void;
  gameDirectory: string;
}) {
  const [blueprint, dispatchGame] = subscribe<Blueprint | undefined>([
    "blueprints",
    blueprintName,
  ]);
  const [activeTab, setActiveTab] = useState<PanelTab>("blueprint");

  if (!blueprint) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 flex w-64 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1">
        <TabButton
          label="Blueprint"
          isActive={activeTab === "blueprint"}
          onSelect={() => setActiveTab("blueprint")}
        />
        <TabButton
          label="Settings"
          isActive={activeTab === "settings"}
          onSelect={() => setActiveTab("settings")}
        />
      </div>

      {activeTab === "blueprint" ? (
        <BlueprintTab
          blueprint={blueprint}
          dispatch={dispatchGame}
          gameDirectory={gameDirectory}
          onRename={onRename}
        />
      ) : (
        <SettingsTab
          subscribe={subscribe}
        />
      )}
    </div>
  );
}
