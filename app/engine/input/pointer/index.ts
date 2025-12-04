import { PointerInterpreter } from "./interpreter";
import { createMoveStrategy } from "./moveStrategy";
import { createResizeStrategy } from "./resizeStrategy";
import { createSelectStrategy } from "./selectStrategy";

export function createPointerInterpreter() {
  return new PointerInterpreter([
    createResizeStrategy(),
    createMoveStrategy(),
    createSelectStrategy(),
  ]);
}

export {
  findTopThingAtPoint,
  getResizeAnchor,
  getWorldPointFromClient,
  hitTestResizeHandle,
  hitTestThing,
  rotatePoint,
} from "./hitTests";

export { buildDragTargetsFromSelection } from "./dragTargets";

export type {
  PointerDragTarget,
  PointerInteractionContext,
  PointerInteractionSession,
  PointerInteractionStrategy,
} from "./types";
