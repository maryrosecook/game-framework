import { GameSubscribe } from "@/engine/useGame";
import { ColorGrid } from "@/components/ColorGrid";

export function SettingsTab({
  subscribe,
}: {
  subscribe: GameSubscribe;
}) {
  const [backgroundColor, dispatch] = subscribe<string>(["backgroundColor"]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Background color
        </p>
        <div className="mt-2">
          <ColorGrid
            selected={backgroundColor}
            onSelect={(color) =>
              dispatch({ type: "setBackgroundColor", color })
            }
          />
        </div>
      </div>
    </div>
  );
}
