import { getBlueprintForThing } from "./blueprints";
import { Blueprint, Thing } from "./types";

const EPSILON = 0.0001;

export function physicsStep(
  things: Thing[],
  blueprintLookup: Map<string, Blueprint>
) {
  for (const thing of things) {
    thing.x += thing.velocity.x;
    thing.y += thing.velocity.y;
  }

  for (let i = 0; i < things.length; i += 1) {
    for (let j = i + 1; j < things.length; j += 1) {
      resolveCollision(things[i], things[j], blueprintLookup);
    }
  }
}

function resolveCollision(
  a: Thing,
  b: Thing,
  blueprintLookup: Map<string, Blueprint>
) {
  if (!boxesOverlap(a, b)) {
    return;
  }

  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  if (overlapX <= 0 || overlapY <= 0) {
    return;
  }

  const axis = overlapX < overlapY ? "x" : "y";
  const displace = axis === "x" ? overlapX : overlapY;
  const canMoveA = a.physicsType === "dynamic";
  const canMoveB = b.physicsType === "dynamic";

  if (!canMoveA && !canMoveB) {
    notifyCollision(a, b, blueprintLookup);
    return;
  }

  if (axis === "x") {
    const aLeftOfB = a.x + a.width / 2 < b.x + b.width / 2;
    const direction = aLeftOfB ? -1 : 1;
    const separation = displace + EPSILON;
    if (canMoveA && canMoveB) {
      a.x += (direction * separation) / 2;
      b.x -= (direction * separation) / 2;
    } else if (canMoveA) {
      a.x += direction * separation;
    } else if (canMoveB) {
      b.x -= direction * separation;
    }
    if (canMoveA) {
      a.velocity.x = 0;
    }
    if (canMoveB) {
      b.velocity.x = 0;
    }
  } else {
    const aAboveB = a.y + a.height / 2 < b.y + b.height / 2;
    const direction = aAboveB ? -1 : 1;
    const separation = displace + EPSILON;
    if (canMoveA && canMoveB) {
      a.y += (direction * separation) / 2;
      b.y -= (direction * separation) / 2;
    } else if (canMoveA) {
      a.y += direction * separation;
    } else if (canMoveB) {
      b.y -= direction * separation;
    }
    if (canMoveA) {
      a.velocity.y = 0;
    }
    if (canMoveB) {
      b.velocity.y = 0;
    }
  }

  notifyCollision(a, b, blueprintLookup);
}

function boxesOverlap(a: Thing, b: Thing) {
  return !(
    a.x + a.width <= b.x ||
    a.x >= b.x + b.width ||
    a.y + a.height <= b.y ||
    a.y >= b.y + b.height
  );
}

function notifyCollision(
  a: Thing,
  b: Thing,
  blueprintLookup: Map<string, Blueprint>
) {
  const blueprintA = getBlueprintForThing(a, blueprintLookup);
  const blueprintB = getBlueprintForThing(b, blueprintLookup);
  blueprintA?.collision?.(a, b);
  blueprintB?.collision?.(b, a);
}
