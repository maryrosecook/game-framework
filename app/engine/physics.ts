import { getBlueprintForThing, runBlueprintHandlers } from "./blueprints";
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
const simulatedThingIds = new Set<string>();

type PolygonCollisionShape = {
  kind: "polygon";
  points: Vector[];
  center: Vector;
};

type CircleCollisionShape = {
  kind: "circle";
  center: Vector;
  radius: number;
};

type CollisionShape = PolygonCollisionShape | CircleCollisionShape;

export function physicsStep(
  gameState: RuntimeGameState,
  blueprintLookup: Map<string, Blueprint>,
  game: GameContext,
  suspendedThingIds: ReadonlySet<string> = new Set()
) {
  game.collidingThingIds.clear();

  const isGravityEnabled = game.gameState.isGravityEnabled;
  const preCollisionVelocities = new Map<string, Vector>();
  const wasGroundedMap = new Map<string, boolean>();
  const hasSimulatedBeforeMap = new Map<string, boolean>();
  const things = [...gameState.things];

  for (const thing of things) {
    wasGroundedMap.set(thing.id, thing.isGrounded);
    hasSimulatedBeforeMap.set(thing.id, simulatedThingIds.has(thing.id));
    thing.isGrounded = false;
    simulatedThingIds.add(thing.id);
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
        isGravityEnabled,
        hasSimulatedBeforeMap,
        wasGroundedMap
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
  gravityEnabled: boolean,
  hasSimulatedBeforeMap: Map<string, boolean>,
  wasGroundedMap: Map<string, boolean>
) {
  const stillExistsA = gameState.things.includes(a);
  const stillExistsB = gameState.things.includes(b);
  if (!stillExistsA || !stillExistsB) {
    return;
  }

  const shapeA = getCollisionShapeForThing(a, blueprintLookup);
  const shapeB = getCollisionShapeForThing(b, blueprintLookup);
  const mtv = getMinimumTranslationVector(shapeA, shapeB);

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
    shapeA,
    shapeB,
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
      gravityEnabled,
      hasSimulatedBeforeMap.get(a.id) ?? false,
      wasGroundedMap.get(a.id) ?? false
    );
  }

  if (canMoveB) {
    updateGroundedState(
      b,
      normalForB,
      preCollisionVelocities.get(b.id),
      gravityEnabled,
      hasSimulatedBeforeMap.get(b.id) ?? false,
      wasGroundedMap.get(b.id) ?? false
    );
  }

  notifyCollision(a, b, blueprintLookup, game);
}

export function getClosestPointsBetweenThings(
  first: RuntimeThing,
  second: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
): { pointOnA: Vector; pointOnB: Vector; distance: number } {
  const shapeA = getCollisionShapeForThing(first, blueprintLookup);
  const shapeB = getCollisionShapeForThing(second, blueprintLookup);
  const mtv = getMinimumTranslationVector(shapeA, shapeB);

  if (mtv) {
    return {
      pointOnA: getShapeCenter(shapeA),
      pointOnB: getShapeCenter(shapeB),
      distance: 0,
    };
  }

  return getClosestPointsBetweenShapes(shapeA, shapeB);
}

function notifyCollision(
  a: RuntimeThing,
  b: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>,
  game: GameContext
) {
  const blueprintA = getBlueprintForThing(a, blueprintLookup);
  const blueprintB = getBlueprintForThing(b, blueprintLookup);
  runBlueprintHandlers(
    "collision",
    blueprintA,
    blueprintA?.collision,
    (handler) => handler(a, b, game)
  );
  runBlueprintHandlers(
    "collision",
    blueprintB,
    blueprintB?.collision,
    (handler) => handler(b, a, game)
  );
}

function getCollisionShapeForThing(
  thing: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
): CollisionShape {
  const shape = getShapeForThing(thing, blueprintLookup);

  if (shape === "circle") {
    const radius = thing.width / 2;
    const center = {
      x: thing.x + thing.width / 2,
      y: thing.y + thing.height / 2,
    };
    return { kind: "circle", center, radius };
  }

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
  const center = { x: thing.x + halfWidth, y: thing.y + halfHeight };

  const points = localPoints.map((point) => ({
    x: center.x + point.x * cos - point.y * sin,
    y: center.y + point.x * sin + point.y * cos,
  }));

  return { kind: "polygon", points, center: computeCentroid(points) };
}

function getShapeForThing(
  thing: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
): Shape {
  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  return blueprint?.shape ?? "rectangle";
}

function getAxes(points: Vector[]) {
  const axes: Vector[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const edge = { x: next.x - current.x, y: next.y - current.y };
    const lengthSquared = edge.x * edge.x + edge.y * edge.y;
    if (lengthSquared <= EPSILON) {
      continue;
    }
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

function projectShape(shape: CollisionShape, axis: Vector) {
  if (shape.kind === "circle") {
    const projection = shape.center.x * axis.x + shape.center.y * axis.y;
    return { min: projection - shape.radius, max: projection + shape.radius };
  }
  return project(shape.points, axis);
}

function getMinimumTranslationVector(
  shapeA: CollisionShape,
  shapeB: CollisionShape
) {
  if (shapeA.kind === "circle" && shapeB.kind === "circle") {
    return getCircleCircleMinimumTranslationVector(shapeA, shapeB);
  }

  const axes = getAxesForShapes(shapeA, shapeB);

  if (axes.length === 0) {
    return null;
  }

  let smallestAxis: Vector | null = null;
  let smallestOverlap = Infinity;

  for (const axis of axes) {
    const projectionA = projectShape(shapeA, axis);
    const projectionB = projectShape(shapeB, axis);
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

function getAxesForShapes(
  shapeA: CollisionShape,
  shapeB: CollisionShape
): Vector[] {
  const axes: Vector[] = [];

  if (shapeA.kind === "polygon") {
    axes.push(...getAxes(shapeA.points));
  }
  if (shapeB.kind === "polygon") {
    axes.push(...getAxes(shapeB.points));
  }

  if (shapeA.kind === "circle" && shapeB.kind === "polygon") {
    const axis = getCircleToPolygonAxis(shapeA, shapeB);
    if (axis) {
      axes.push(axis);
    }
  } else if (shapeB.kind === "circle" && shapeA.kind === "polygon") {
    const axis = getCircleToPolygonAxis(shapeB, shapeA);
    if (axis) {
      axes.push(axis);
    }
  }

  return axes;
}

function getCircleCircleMinimumTranslationVector(
  circleA: CircleCollisionShape,
  circleB: CircleCollisionShape
) {
  const offset = {
    x: circleB.center.x - circleA.center.x,
    y: circleB.center.y - circleA.center.y,
  };
  const distance = Math.hypot(offset.x, offset.y);
  const radiusSum = circleA.radius + circleB.radius;

  if (distance >= radiusSum) {
    return null;
  }

  if (distance <= EPSILON) {
    return { axis: { x: 1, y: 0 }, overlap: radiusSum };
  }

  return { axis: { x: offset.x / distance, y: offset.y / distance }, overlap: radiusSum - distance };
}

function getCircleToPolygonAxis(
  circle: CircleCollisionShape,
  polygon: PolygonCollisionShape
): Vector | null {
  const closestPoint = getClosestPointOnPolygon(polygon.points, circle.center);
  const direction = {
    x: closestPoint.x - circle.center.x,
    y: closestPoint.y - circle.center.y,
  };
  const distanceSquared = direction.x * direction.x + direction.y * direction.y;

  if (distanceSquared <= EPSILON) {
    const fallback = {
      x: polygon.center.x - circle.center.x,
      y: polygon.center.y - circle.center.y,
    };
    const fallbackLengthSquared =
      fallback.x * fallback.x + fallback.y * fallback.y;
    if (fallbackLengthSquared <= EPSILON) {
      return { x: 1, y: 0 };
    }
    return normalize(fallback);
  }

  return normalize(direction);
}

function getClosestPointOnPolygon(points: Vector[], point: Vector): Vector {
  let closestPoint = points[0];
  let smallestDistanceSquared = Infinity;

  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const candidate = getClosestPointOnSegment(point, start, end);
    const distanceSquared = getDistanceSquared(candidate, point);
    if (distanceSquared < smallestDistanceSquared) {
      smallestDistanceSquared = distanceSquared;
      closestPoint = candidate;
    }
  }

  return closestPoint;
}

function getClosestPointOnSegment(point: Vector, start: Vector, end: Vector) {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const segmentLengthSquared =
    segment.x * segment.x + segment.y * segment.y || 1;

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) /
        segmentLengthSquared
    )
  );

  return {
    x: start.x + segment.x * t,
    y: start.y + segment.y * t,
  };
}

function getDistanceSquared(a: Vector, b: Vector) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function getClosestPointsBetweenShapes(
  shapeA: CollisionShape,
  shapeB: CollisionShape
): { pointOnA: Vector; pointOnB: Vector; distance: number } {
  if (shapeA.kind === "circle" && shapeB.kind === "circle") {
    return getClosestPointsCircleCircle(shapeA, shapeB);
  }

  if (shapeA.kind === "circle" && shapeB.kind === "polygon") {
    return getClosestPointsCirclePolygon(shapeA, shapeB);
  }

  if (shapeA.kind === "polygon" && shapeB.kind === "circle") {
    const swapped = getClosestPointsCirclePolygon(shapeB, shapeA);
    return {
      pointOnA: swapped.pointOnB,
      pointOnB: swapped.pointOnA,
      distance: swapped.distance,
    };
  }

  if (shapeA.kind === "polygon" && shapeB.kind === "polygon") {
    return getClosestPointsPolygonPolygon(shapeA, shapeB);
  }

  return {
    pointOnA: getShapeCenter(shapeA),
    pointOnB: getShapeCenter(shapeB),
    distance: 0,
  };
}

function getClosestPointsCircleCircle(
  circleA: CircleCollisionShape,
  circleB: CircleCollisionShape
) {
  const offset = {
    x: circleB.center.x - circleA.center.x,
    y: circleB.center.y - circleA.center.y,
  };
  const distance = Math.hypot(offset.x, offset.y);
  const radiusSum = circleA.radius + circleB.radius;

  if (distance === 0) {
    return {
      pointOnA: { x: circleA.center.x + circleA.radius, y: circleA.center.y },
      pointOnB: { x: circleB.center.x - circleB.radius, y: circleB.center.y },
      distance: 0,
    };
  }

  const direction = { x: offset.x / distance, y: offset.y / distance };
  const surfaceDistance = Math.max(distance - radiusSum, 0);

  return {
    pointOnA: {
      x: circleA.center.x + direction.x * circleA.radius,
      y: circleA.center.y + direction.y * circleA.radius,
    },
    pointOnB: {
      x: circleB.center.x - direction.x * circleB.radius,
      y: circleB.center.y - direction.y * circleB.radius,
    },
    distance: surfaceDistance,
  };
}

function getClosestPointsCirclePolygon(
  circle: CircleCollisionShape,
  polygon: PolygonCollisionShape
) {
  if (isPointInsidePolygon(circle.center, polygon.points)) {
    return {
      pointOnA: circle.center,
      pointOnB: polygon.center,
      distance: 0,
    };
  }

  const closestOnPolygon = getClosestPointOnPolygon(polygon.points, circle.center);
  const toPolygon = {
    x: closestOnPolygon.x - circle.center.x,
    y: closestOnPolygon.y - circle.center.y,
  };
  const distanceToPolygon = Math.hypot(toPolygon.x, toPolygon.y);
  const direction =
    distanceToPolygon === 0
      ? { x: 1, y: 0 }
      : { x: toPolygon.x / distanceToPolygon, y: toPolygon.y / distanceToPolygon };
  const pointOnCircle = {
    x: circle.center.x + direction.x * circle.radius,
    y: circle.center.y + direction.y * circle.radius,
  };
  const gap = Math.max(distanceToPolygon - circle.radius, 0);

  return {
    pointOnA: pointOnCircle,
    pointOnB: closestOnPolygon,
    distance: gap,
  };
}

function getClosestPointsPolygonPolygon(
  polygonA: PolygonCollisionShape,
  polygonB: PolygonCollisionShape
) {
  let bestDistanceSquared = Infinity;
  let bestPointA = polygonA.points[0];
  let bestPointB = polygonB.points[0];

  for (const point of polygonA.points) {
    const candidateOnB = getClosestPointOnPolygon(polygonB.points, point);
    const distanceSquared = getDistanceSquared(point, candidateOnB);
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestPointA = point;
      bestPointB = candidateOnB;
    }
  }

  for (const point of polygonB.points) {
    const candidateOnA = getClosestPointOnPolygon(polygonA.points, point);
    const distanceSquared = getDistanceSquared(point, candidateOnA);
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestPointA = candidateOnA;
      bestPointB = point;
    }
  }

  return {
    pointOnA: bestPointA,
    pointOnB: bestPointB,
    distance: Math.sqrt(bestDistanceSquared),
  };
}

function isPointInsidePolygon(point: Vector, polygon: Vector[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function computeCentroid(points: Vector[]) {
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function getShapeCenter(shape: CollisionShape): Vector {
  return shape.center;
}

function computeSeparationVector(
  shapeA: CollisionShape,
  shapeB: CollisionShape,
  axis: Vector,
  overlap: number
): Vector {
  const centerA = getShapeCenter(shapeA);
  const centerB = getShapeCenter(shapeB);
  const alignment =
    (centerB.x - centerA.x) * axis.x + (centerB.y - centerA.y) * axis.y;
  const separationDirection = alignment > 0 ? -1 : 1;
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
  gravityEnabled: boolean,
  hasSimulatedBefore: boolean,
  wasGroundedPreviously: boolean
) {
  if (!gravityEnabled) return;
  if (thing.physicsType !== "dynamic") return;

  const alignmentWithDown =
    contactNormal.x * DOWN_VECTOR.x + contactNormal.y * DOWN_VECTOR.y;

  if (alignmentWithDown <= -GROUND_NORMAL_THRESHOLD) {
    const verticalVelocity = preCollisionVelocity?.y ?? 0;
    const isLanding = verticalVelocity > GROUND_VELOCITY_EPSILON;
    const isInitialGrounding =
      !hasSimulatedBefore &&
      Math.abs(verticalVelocity) <= GROUND_VELOCITY_EPSILON;
    const isPersistingGroundContact =
      wasGroundedPreviously && verticalVelocity >= -GROUND_VELOCITY_EPSILON;

    if (isLanding || isInitialGrounding || isPersistingGroundContact) {
      thing.isGrounded = true;
    }
  }
}
