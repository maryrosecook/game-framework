import { getBlueprintForThing } from "./blueprints";
import {
  Blueprint,
  CollisionMap,
  GameContext,
  RuntimeGameState,
  RuntimeThing,
  Shape,
  Vector,
} from "./types";

const EPSILON = 0.0001;
const GRAVITY_ACCELERATION = 0.1;
const GROUND_NORMAL_THRESHOLD = 0.7;
const GROUND_VELOCITY_EPSILON = 0.0001;
const DOWN_VECTOR: Vector = { x: 0, y: 1 };

export function physicsStep(
  gameState: RuntimeGameState,
  blueprintLookup: Map<string, Blueprint>,
  game: GameContext,
  suspendedThingIds: ReadonlySet<string> = new Set()
) {
  game.collidingThingIds.clear();

  const isGravityEnabled = game.gameState.isGravityEnabled;
  const preCollisionVelocities = new Map<string, Vector>();
  const things = [...gameState.things];

  for (const thing of things) {
    thing.isGrounded = false;
    if (suspendedThingIds.has(thing.id)) continue;

    let nextVelocity: Vector = { x: thing.velocityX, y: thing.velocityY };

    if (isGravityEnabled && thing.physicsType === "dynamic") {
      nextVelocity = {
        ...nextVelocity,
        y: nextVelocity.y + GRAVITY_ACCELERATION,
      };
    }

    const blueprint = getBlueprintForThing(thing, blueprintLookup);
    if (blueprint?.getAdjustedVelocity) {
      nextVelocity = blueprint.getAdjustedVelocity(thing, nextVelocity, game);
    }

    thing.velocityX = nextVelocity.x;
    thing.velocityY = nextVelocity.y;
    preCollisionVelocities.set(thing.id, { ...nextVelocity });
  }

  for (const thing of things) {
    if (suspendedThingIds.has(thing.id)) continue;
    thing.x += thing.velocityX;
    thing.y += thing.velocityY;
  }

  for (let i = 0; i < things.length; i += 1) {
    for (let j = i + 1; j < things.length; j += 1) {
      if (
        suspendedThingIds.has(things[i].id) ||
        suspendedThingIds.has(things[j].id)
      ) {
        continue;
      }
      resolveCollision(
        things[i],
        things[j],
        blueprintLookup,
        gameState,
        game.collidingThingIds,
        game,
        preCollisionVelocities,
        isGravityEnabled
      );
    }
  }
}

function resolveCollision(
  a: RuntimeThing,
  b: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>,
  gameState: RuntimeGameState,
  collidingThingIds: CollisionMap,
  game: GameContext,
  preCollisionVelocities: Map<string, Vector>,
  gravityEnabled: boolean
) {
  const stillExistsA = gameState.things.includes(a);
  const stillExistsB = gameState.things.includes(b);
  if (!stillExistsA || !stillExistsB) {
    return;
  }

  const polygonA = getPolygonForThing(a, blueprintLookup);
  const polygonB = getPolygonForThing(b, blueprintLookup);
  const mtv = getMinimumTranslationVector(polygonA, polygonB);

  if (!mtv) {
    return;
  }

  recordCollision(collidingThingIds, a, b);

  if (a.physicsType === "ambient" || b.physicsType === "ambient") {
    notifyCollision(a, b, blueprintLookup, game);
    return;
  }

  const canMoveA = a.physicsType === "dynamic";
  const canMoveB = b.physicsType === "dynamic";

  const separationVector = computeSeparationVector(
    polygonA,
    polygonB,
    mtv.axis,
    mtv.overlap + EPSILON
  );

  const normalForA = normalize(separationVector);
  const normalForB = { x: -normalForA.x, y: -normalForA.y };

  if (!canMoveA && !canMoveB) {
    notifyCollision(a, b, blueprintLookup, game);
    return;
  }

  if (canMoveA && canMoveB) {
    a.x += separationVector.x / 2;
    a.y += separationVector.y / 2;
    b.x -= separationVector.x / 2;
    b.y -= separationVector.y / 2;
    dampenVelocity(a, mtv.axis);
    dampenVelocity(b, mtv.axis);
  } else if (canMoveA) {
    a.x += separationVector.x;
    a.y += separationVector.y;
    dampenVelocity(a, mtv.axis);
  } else if (canMoveB) {
    b.x -= separationVector.x;
    b.y -= separationVector.y;
    dampenVelocity(b, mtv.axis);
  }

  if (canMoveA) {
    updateGroundedState(
      a,
      normalForA,
      preCollisionVelocities.get(a.id),
      gravityEnabled
    );
  }

  if (canMoveB) {
    updateGroundedState(
      b,
      normalForB,
      preCollisionVelocities.get(b.id),
      gravityEnabled
    );
  }

  notifyCollision(a, b, blueprintLookup, game);
}

function notifyCollision(
  a: RuntimeThing,
  b: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>,
  game: GameContext
) {
  const blueprintA = getBlueprintForThing(a, blueprintLookup);
  const blueprintB = getBlueprintForThing(b, blueprintLookup);
  blueprintA?.collision?.(a, b, game);
  blueprintB?.collision?.(b, a, game);
}

function getPolygonForThing(
  thing: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
) {
  const shape = getShapeForThing(thing, blueprintLookup);
  const halfWidth = thing.width / 2;
  const halfHeight = thing.height / 2;

  const localPoints: Vector[] =
    shape === "triangle"
      ? [
          { x: -halfWidth, y: halfHeight },
          { x: halfWidth, y: halfHeight },
          { x: 0, y: -halfHeight },
        ]
      : [
          { x: -halfWidth, y: -halfHeight },
          { x: halfWidth, y: -halfHeight },
          { x: halfWidth, y: halfHeight },
          { x: -halfWidth, y: halfHeight },
        ];

  const angle = (thing.angle * Math.PI) / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const centerX = thing.x + halfWidth;
  const centerY = thing.y + halfHeight;

  return localPoints.map((point) => ({
    x: centerX + point.x * cos - point.y * sin,
    y: centerY + point.x * sin + point.y * cos,
  }));
}

function getShapeForThing(
  thing: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
): Shape {
  if (thing.shape) {
    return thing.shape;
  }
  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  return blueprint?.shape ?? "rectangle";
}

function getAxes(points: Vector[]) {
  const axes: Vector[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const edge = { x: next.x - current.x, y: next.y - current.y };
    const normal = normalize({ x: -edge.y, y: edge.x });
    axes.push(normal);
  }
  return axes;
}

function normalize(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function project(points: Vector[], axis: Vector) {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const projected = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, projected);
    max = Math.max(max, projected);
  }
  return { min, max };
}

function getMinimumTranslationVector(pointsA: Vector[], pointsB: Vector[]) {
  const axes = [...getAxes(pointsA), ...getAxes(pointsB)];
  let smallestAxis: Vector | null = null;
  let smallestOverlap = Infinity;

  for (const axis of axes) {
    const projectionA = project(pointsA, axis);
    const projectionB = project(pointsB, axis);
    const overlap =
      Math.min(projectionA.max, projectionB.max) -
      Math.max(projectionA.min, projectionB.min);
    if (overlap <= 0) {
      return null;
    }
    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      smallestAxis = axis;
    }
  }

  if (!smallestAxis || !Number.isFinite(smallestOverlap)) {
    return null;
  }

  return { axis: normalize(smallestAxis), overlap: smallestOverlap };
}

function computeCentroid(points: Vector[]) {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function computeSeparationVector(
  pointsA: Vector[],
  pointsB: Vector[],
  axis: Vector,
  overlap: number
): Vector {
  const centroidA = computeCentroid(pointsA);
  const centroidB = computeCentroid(pointsB);
  const direction =
    Math.sign(
      (centroidB.x - centroidA.x) * axis.x +
        (centroidB.y - centroidA.y) * axis.y
    ) || 1;
  const separationDirection = direction > 0 ? -1 : 1;
  return {
    x: axis.x * overlap * separationDirection,
    y: axis.y * overlap * separationDirection,
  };
}

function dampenVelocity(thing: RuntimeThing, axis: Vector) {
  const projected = thing.velocityX * axis.x + thing.velocityY * axis.y;
  thing.velocityX -= projected * axis.x;
  thing.velocityY -= projected * axis.y;
}

function recordCollision(
  map: CollisionMap,
  first: RuntimeThing,
  second: RuntimeThing
) {
  const existingForFirst = map.get(first.id) ?? [];
  const existingForSecond = map.get(second.id) ?? [];
  if (!map.has(first.id)) {
    map.set(first.id, existingForFirst);
  }
  if (!map.has(second.id)) {
    map.set(second.id, existingForSecond);
  }
  if (!existingForFirst.includes(second.id)) {
    existingForFirst.push(second.id);
  }
  if (!existingForSecond.includes(first.id)) {
    existingForSecond.push(first.id);
  }
}

function updateGroundedState(
  thing: RuntimeThing,
  contactNormal: Vector,
  preCollisionVelocity: Vector | undefined,
  gravityEnabled: boolean
) {
  if (!gravityEnabled) return;
  if (thing.physicsType !== "dynamic") return;

  const alignmentWithDown =
    contactNormal.x * DOWN_VECTOR.x + contactNormal.y * DOWN_VECTOR.y;

  if (alignmentWithDown <= -GROUND_NORMAL_THRESHOLD) {
    const verticalVelocity = preCollisionVelocity?.y ?? 0;
    if (verticalVelocity >= -GROUND_VELOCITY_EPSILON) {
      thing.isGrounded = true;
    }
  }
}
