import { GameSubscribe } from "@/engine/useGame";
import { ColorGrid } from "@/components/ColorGrid";

export function SettingsTab({ subscribe }: { subscribe: GameSubscribe }) {
  const [backgroundColor, dispatch] = subscribe<string>(["backgroundColor"]);
  const [isGravityEnabled] = subscribe<boolean>(["isGravityEnabled"]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 accent-slate-900"
            checked={isGravityEnabled}
            onChange={(event) =>
              dispatch({
                type: "setGravityEnabled",
                isGravityEnabled: event.target.checked,
              })
            }
          />
          Enable gravity
        </label>
      </div>
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
