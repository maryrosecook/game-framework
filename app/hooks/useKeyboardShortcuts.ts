import { useEffect } from "react";
import { GameEngine } from "@/engine/engine";

export function useKeyboardShortcuts({
  engine,
  selectedThingIds,
}: {
  engine: GameEngine;
  selectedThingIds: string[];
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          /^(input|textarea|select)$/i.test(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        return;
      }
      if (event.key !== "Backspace") return;
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
  }, [engine, selectedThingIds]);
}
