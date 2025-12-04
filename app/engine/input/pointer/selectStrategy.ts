import { PointerInteractionStrategy } from "./types";
import { nextSelectedIdsForClick } from "./selectionHelpers";

export function createSelectStrategy(): PointerInteractionStrategy {
  return {
    canStart({ event, hit, state, context }) {
      if (context.pointerMode !== "pointer") {
        return null;
      }
      if (hit) {
        const nextSelected = nextSelectedIdsForClick(
          state.selectedThingIds,
          hit.id,
          event.shiftKey
        );
        context.dispatch({
          type: "setSelectedThingIds",
          thingIds: nextSelected,
        });
        return null;
      }

      context.dispatch({ type: "setSelectedThingIds", thingIds: [] });
      return null;
    },
  };
}
