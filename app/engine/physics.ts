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
const NORMAL_VELOCITY_EPSILON = 0.0001;
const MIN_WEIGHT = 0.0001;
const POSITION_SLOP = 0.01;
const POSITION_CORRECTION_PERCENT = 0.8;
const SOLVER_ITERATIONS = 6;
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

type PhysicsMaterial = {
  weight: number;
  invMass: number;
  bounce: number;
};

export function physicsStep(
  gameState: RuntimeGameState,
  blueprintLookup: Map<string, Blueprint>,
  game: GameContext,
  suspendedThingIds: ReadonlySet<string> = new Set()
) {
  game.collidingThingIds.clear();

  const isGravityEnabled = game.gameState.isGravityEnabled;
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
  }

  const substeps = computeSubsteps(things, suspendedThingIds);
  const stepScale = 1 / substeps;

  for (let step = 0; step < substeps; step += 1) {
    for (const thing of things) {
      if (suspendedThingIds.has(thing.id)) continue;
      thing.x += thing.velocityX * stepScale;
      thing.y += thing.velocityY * stepScale;
    }

    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
      let resolvedAny = false;
      for (let i = 0; i < things.length; i += 1) {
        for (let j = i + 1; j < things.length; j += 1) {
          if (
            suspendedThingIds.has(things[i].id) ||
            suspendedThingIds.has(things[j].id)
          ) {
            continue;
          }
          const resolved = resolveCollision(
            things[i],
            things[j],
            blueprintLookup,
            gameState,
            game.collidingThingIds,
            game,
            isGravityEnabled,
            hasSimulatedBeforeMap,
            wasGroundedMap
          );
          if (resolved) {
            resolvedAny = true;
          }
        }
      }
      if (!resolvedAny) {
        break;
      }
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
  gravityEnabled: boolean,
  hasSimulatedBeforeMap: Map<string, boolean>,
  wasGroundedMap: Map<string, boolean>
): boolean {
  const stillExistsA = gameState.things.includes(a);
  const stillExistsB = gameState.things.includes(b);
  if (!stillExistsA || !stillExistsB) {
    return false;
  }

  const shapeA = getCollisionShapeForThing(a, blueprintLookup);
  const shapeB = getCollisionShapeForThing(b, blueprintLookup);
  const mtv = getMinimumTranslationVector(shapeA, shapeB);

  if (!mtv) {
    return false;
  }

  const isNewCollision = recordCollision(collidingThingIds, a, b);
  const preCollisionVelocityA = { x: a.velocityX, y: a.velocityY };
  const preCollisionVelocityB = { x: b.velocityX, y: b.velocityY };

  if (a.physicsType === "ambient" || b.physicsType === "ambient") {
    if (isNewCollision) {
      notifyCollision(a, b, blueprintLookup, game);
    }
    return true;
  }

  const canMoveA = a.physicsType === "dynamic";
  const canMoveB = b.physicsType === "dynamic";

  const separationVector = computeSeparationVector(
    shapeA,
    shapeB,
    mtv.axis,
    mtv.overlap
  );

  const contactNormalForA = normalize(separationVector);
  const collisionNormal = { x: -contactNormalForA.x, y: -contactNormalForA.y };

  if (!canMoveA && !canMoveB) {
    if (isNewCollision) {
      notifyCollision(a, b, blueprintLookup, game);
    }
    return true;
  }

  const materialA = getPhysicsMaterial(a, blueprintLookup);
  const materialB = getPhysicsMaterial(b, blueprintLookup);
  const invMassA = canMoveA ? materialA.invMass : 0;
  const invMassB = canMoveB ? materialB.invMass : 0;
  const totalInvMass = invMassA + invMassB;

  if (totalInvMass > 0) {
    applyPositionCorrection(a, b, collisionNormal, mtv.overlap, invMassA, invMassB);

    const relativeVelocity = {
      x: b.velocityX - a.velocityX,
      y: b.velocityY - a.velocityY,
    };
    const velocityAlongNormal =
      relativeVelocity.x * collisionNormal.x +
      relativeVelocity.y * collisionNormal.y;

    if (velocityAlongNormal < 0) {
      const bounce = combineBounce(materialA.bounce, materialB.bounce);
      const impulseMagnitude =
        (-(1 + bounce) * velocityAlongNormal) / totalInvMass;
      applyImpulse(a, b, collisionNormal, impulseMagnitude, invMassA, invMassB);
    }

    if (canMoveA) {
      removeSmallNormalVelocity(a, collisionNormal);
    }
    if (canMoveB) {
      removeSmallNormalVelocity(b, collisionNormal);
    }
  }

  if (canMoveA) {
    updateGroundedState(
      a,
      contactNormalForA,
      preCollisionVelocityA,
      gravityEnabled,
      hasSimulatedBeforeMap.get(a.id) ?? false,
      wasGroundedMap.get(a.id) ?? false
    );
  }

  if (canMoveB) {
    updateGroundedState(
      b,
      { x: -contactNormalForA.x, y: -contactNormalForA.y },
      preCollisionVelocityB,
      gravityEnabled,
      hasSimulatedBeforeMap.get(b.id) ?? false,
      wasGroundedMap.get(b.id) ?? false
    );
  }

  if (isNewCollision) {
    notifyCollision(a, b, blueprintLookup, game);
  }

  return true;
}

function computeSubsteps(
  things: RuntimeThing[],
  suspendedThingIds: ReadonlySet<string>
) {
  let maxSubsteps = 1;
  for (const thing of things) {
    if (suspendedThingIds.has(thing.id)) continue;
    if (thing.physicsType !== "dynamic") continue;
    const speed = Math.hypot(thing.velocityX, thing.velocityY);
    if (!Number.isFinite(speed) || speed <= EPSILON) continue;
    const minExtent = Math.min(thing.width, thing.height) / 2;
    const maxStep = Math.max(1, minExtent * 0.5);
    const stepsForThing = Math.ceil(speed / maxStep);
    if (Number.isFinite(stepsForThing)) {
      maxSubsteps = Math.max(maxSubsteps, stepsForThing);
    }
  }
  return Math.max(1, maxSubsteps);
}

function getPhysicsMaterial(
  thing: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
): PhysicsMaterial {
  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  const rawWeight = blueprint?.weight ?? 1;
  const rawBounce = blueprint?.bounce ?? 0;
  const weightValue = Number.isFinite(rawWeight) ? rawWeight : 1;
  const bounceValue = Number.isFinite(rawBounce) ? rawBounce : 0;
  const weight = weightValue > MIN_WEIGHT ? weightValue : MIN_WEIGHT;
  const bounce = clamp(bounceValue, 0, 1);
  const invMass = thing.physicsType === "dynamic" ? 1 / weight : 0;
  return { weight, invMass, bounce };
}

function combineBounce(a: number, b: number) {
  return Math.min(a, b);
}

function applyPositionCorrection(
  a: RuntimeThing,
  b: RuntimeThing,
  normal: Vector,
  overlap: number,
  invMassA: number,
  invMassB: number
) {
  const totalInvMass = invMassA + invMassB;
  if (totalInvMass <= 0) {
    return;
  }
  const correctionMagnitude =
    (Math.max(overlap - POSITION_SLOP, 0) * POSITION_CORRECTION_PERCENT) /
    totalInvMass;
  const correction = {
    x: normal.x * correctionMagnitude,
    y: normal.y * correctionMagnitude,
  };
  if (invMassA > 0) {
    a.x -= correction.x * invMassA;
    a.y -= correction.y * invMassA;
  }
  if (invMassB > 0) {
    b.x += correction.x * invMassB;
    b.y += correction.y * invMassB;
  }
}

function applyImpulse(
  a: RuntimeThing,
  b: RuntimeThing,
  normal: Vector,
  magnitude: number,
  invMassA: number,
  invMassB: number
) {
  const impulse = { x: normal.x * magnitude, y: normal.y * magnitude };
  if (invMassA > 0) {
    a.velocityX -= impulse.x * invMassA;
    a.velocityY -= impulse.y * invMassA;
  }
  if (invMassB > 0) {
    b.velocityX += impulse.x * invMassB;
    b.velocityY += impulse.y * invMassB;
  }
}

function removeSmallNormalVelocity(thing: RuntimeThing, normal: Vector) {
  const normalVelocity = thing.velocityX * normal.x + thing.velocityY * normal.y;
  if (Math.abs(normalVelocity) < NORMAL_VELOCITY_EPSILON) {
    thing.velocityX -= normalVelocity * normal.x;
    thing.velocityY -= normalVelocity * normal.y;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function recordCollision(
  map: CollisionMap,
  first: RuntimeThing,
  second: RuntimeThing
): boolean {
  const existingForFirst = map.get(first.id) ?? [];
  const existingForSecond = map.get(second.id) ?? [];
  const alreadyRecorded = existingForFirst.includes(second.id);
  if (!map.has(first.id)) {
    map.set(first.id, existingForFirst);
  }
  if (!map.has(second.id)) {
    map.set(second.id, existingForSecond);
  }
  if (!alreadyRecorded) {
    existingForFirst.push(second.id);
  }
  if (!existingForSecond.includes(first.id)) {
    existingForSecond.push(first.id);
  }
  return !alreadyRecorded;
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
