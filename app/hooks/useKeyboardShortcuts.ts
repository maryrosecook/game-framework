import { useEffect } from "react";
import { GameEngine } from "@/engine/engine";

export function useKeyboardShortcuts({
  engine,
  isPaused,
  selectedThingIds,
}: {
  engine: GameEngine;
  isPaused: boolean;
  selectedThingIds: string[];
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.metaKey) {
        event.preventDefault();
        const paused = engine.getStateAtPath(["isPaused"]) as boolean;
        engine.dispatch({ type: "setPaused", isPaused: !paused });
        return;
      }

      if (!isPaused) return;
      if (event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(input|textarea|select)$/i.test(target.tagName))
      ) {
        return;
      }
      if (selectedThingIds.length === 0) return;
      event.preventDefault();
      for (const id of selectedThingIds) {
        engine.dispatch({ type: "removeThing", thingId: id });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [engine, isPaused, selectedThingIds]);
}
