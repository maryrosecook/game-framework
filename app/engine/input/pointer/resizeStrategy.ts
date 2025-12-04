import {
  getResizeAnchor,
  hitTestResizeHandle,
  rotatePoint,
} from "./hitTests";
import {
  PointerInteractionStrategy,
  PointerInteractionSession,
} from "./types";

export function createResizeStrategy(): PointerInteractionStrategy {
  return {
    canStart({ worldPoint, state, context }) {
      const primaryId = state.selectedThingId;
      if (!primaryId) {
        return null;
      }
      const primary = state.things.find((thing) => thing.id === primaryId);
      if (!primary) {
        return null;
      }
      if (!hitTestResizeHandle(worldPoint, primary)) {
        return null;
      }

      const anchor = getResizeAnchor(primary);
      const angle = primary.angle;
      const editingIds = [primary.id];
      context.beginEditing(editingIds);

      const session: PointerInteractionSession = {
        capture: true,
        onMove: ({ worldPoint: movePoint }) => {
          const angleRad = (angle * Math.PI) / 180;
          const delta = {
            x: movePoint.x - anchor.x,
            y: movePoint.y - anchor.y,
          };
          const rotated = rotatePoint(delta, -angleRad);
          const width = Math.max(10, rotated.x);
          const height = Math.max(10, rotated.y);

          const centerOffset = rotatePoint(
            { x: width / 2, y: height / 2 },
            angleRad
          );
          const center = {
            x: anchor.x + centerOffset.x,
            y: anchor.y + centerOffset.y,
          };

          context.dispatch({
            type: "setThingProperties",
            thingId: primary.id,
            properties: {
              width,
              height,
              x: center.x - width / 2,
              y: center.y - height / 2,
            },
          });
        },
        onUp: () => {
          context.endEditing(editingIds);
        },
        onCancel: () => {
          context.endEditing(editingIds);
        },
      };

      return session;
    },
  };
}
