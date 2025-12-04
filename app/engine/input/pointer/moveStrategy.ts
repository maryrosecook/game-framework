import { buildDragTargetsFromSelection } from "./dragTargets";
import {
  PointerDragTarget,
  PointerInteractionContext,
  PointerInteractionSession,
  PointerInteractionStrategy,
} from "./types";
import { nextSelectedIdsForClick } from "./selectionHelpers";

export function createMoveStrategy(): PointerInteractionStrategy {
  return {
    canStart({ event, worldPoint, hit, state, context }) {
      if (context.pointerMode !== "pointer") {
        return null;
      }
      if (!hit) {
        return null;
      }

      const nextSelected = nextSelectedIdsForClick(
        state.selectedThingIds,
        hit.id,
        event.shiftKey
      );

      if (!nextSelected.includes(hit.id)) {
        return null;
      }

      const targets = buildDragTargetsFromSelection(
        nextSelected,
        worldPoint,
        state.things
      );

      if (targets.length === 0) {
        context.dispatch({
          type: "setSelectedThingIds",
          thingIds: nextSelected,
        });
        return null;
      }

      if (event.altKey) {
        const duplicateTargets = context.duplicateSelection(
          nextSelected,
          worldPoint
        );
        if (duplicateTargets && duplicateTargets.length > 0) {
          const duplicateIds = duplicateTargets.map(
            (target) => target.thingId
          );
          context.dispatch({
            type: "setSelectedThingIds",
            thingIds: duplicateIds,
          });
          context.beginEditing(duplicateIds);
          return createMoveSession(duplicateTargets, context);
        }
      }

      context.dispatch({
        type: "setSelectedThingIds",
        thingIds: nextSelected,
      });
      const editingIds = targets.map((target) => target.thingId);
      context.beginEditing(editingIds);
      return createMoveSession(targets, context);
    },
  };
}

function createMoveSession(
  targets: PointerDragTarget[],
  context: PointerInteractionContext
): PointerInteractionSession {
  const editingIds = targets.map((target) => target.thingId);

  return {
    capture: true,
    onMove: ({ worldPoint }) => {
      for (const target of targets) {
        context.dispatch({
          type: "setThingProperties",
          thingId: target.thingId,
          properties: {
            x: worldPoint.x - target.offsetX,
            y: worldPoint.y - target.offsetY,
          },
        });
      }
    },
    onUp: () => {
      context.endEditing(editingIds);
    },
    onCancel: () => {
      context.endEditing(editingIds);
    },
  };
}
