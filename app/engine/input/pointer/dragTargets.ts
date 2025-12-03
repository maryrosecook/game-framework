import { RuntimeThing, Vector } from "../../types";
import { PointerDragTarget } from "./types";

export function buildDragTargetsFromSelection(
  selectedIds: string[],
  worldPoint: Vector,
  things: RuntimeThing[]
): PointerDragTarget[] {
  const lookup = new Map(things.map((thing) => [thing.id, thing]));
  const targets: PointerDragTarget[] = [];
  for (const id of selectedIds) {
    const thing = lookup.get(id);
    if (!thing) continue;
    targets.push({
      thingId: id,
      offsetX: worldPoint.x - thing.x,
      offsetY: worldPoint.y - thing.y,
    });
  }
  return targets;
}
