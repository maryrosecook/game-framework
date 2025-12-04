import {
  PointerInteractionSession,
  PointerInteractionStrategy,
} from "./types";

export function createPaintStrategy(): PointerInteractionStrategy {
  return {
    canStart({ worldPoint, hit, state, context }) {
      if (context.pointerMode !== "paint") {
        return null;
      }
      if (!hit) {
        return null;
      }

      // Only paint on the selected thing. If it's not selected yet, select it now.
      if (state.selectedThingId !== hit.id) {
        context.dispatch({
          type: "setSelectedThingId",
          thingId: hit.id,
        });
      }

      const editingIds = [hit.id];
      context.beginEditing(editingIds);
      context.paintAt(hit, worldPoint, null);

      let previousPoint = worldPoint;

      const session: PointerInteractionSession = {
        capture: true,
        onMove: ({ worldPoint: nextPoint, state: nextState }) => {
          if (nextState.selectedThingId !== hit.id) return;
          context.paintAt(hit, nextPoint, previousPoint);
          previousPoint = nextPoint;
        },
        onUp: ({ state: nextState }) => {
          if (nextState.selectedThingId === hit.id) {
            context.endEditing(editingIds);
          }
        },
        onCancel: () => {
          context.endEditing(editingIds);
        },
      };

      return session;
    },
  };
}
