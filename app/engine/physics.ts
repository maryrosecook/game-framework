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
const SPATIAL_HASH_CELL_SIZE = 128;
const SOLVER_ITERATIONS = 6;
const DOWN_VECTOR: Vector = { x: 0, y: 1 };
const simulatedThingIds = new Set<string>();

type PolygonCollisionShape = {
  kind: "polygon";
  points: Vector[];
  center: Vector;
  axes?: Vector[];
};

type CircleCollisionShape = {
  kind: "circle";
  center: Vector;
  radius: number;
};

type CollisionShape = PolygonCollisionShape | CircleCollisionShape;

type Aabb = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type CachedPolygonCollisionShape = PolygonCollisionShape & {
  axes: Vector[];
  aabb: Aabb;
};

type CachedCircleCollisionShape = CircleCollisionShape & {
  aabb: Aabb;
};

type CachedCollisionShape =
  | CachedPolygonCollisionShape
  | CachedCircleCollisionShape;

type PhysicsMaterial = {
  weight: number;
  invMass: number;
  bounce: number;
};

type CollisionShapeState = {
  shape: CachedCollisionShape;
  dirty: boolean;
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

  const suspendedFlags = things.map((thing) => suspendedThingIds.has(thing.id));
  const shapeStates: CollisionShapeState[] = things.map((thing) => ({
    shape: getCachedCollisionShapeForThing(thing, blueprintLookup),
    dirty: false,
  }));
  const materials: PhysicsMaterial[] = things.map((thing) =>
    getPhysicsMaterial(thing, blueprintLookup)
  );

  for (let step = 0; step < substeps; step += 1) {
    for (let i = 0; i < shapeStates.length; i += 1) {
      if (!shapeStates[i].dirty) continue;
      shapeStates[i].shape = getCachedCollisionShapeForThing(
        things[i],
        blueprintLookup
      );
      shapeStates[i].dirty = false;
    }

    for (let i = 0; i < things.length; i += 1) {
      if (suspendedFlags[i]) continue;
      const thing = things[i];
      const dx = thing.velocityX * stepScale;
      const dy = thing.velocityY * stepScale;
      thing.x += dx;
      thing.y += dy;
      translateCollisionShape(shapeStates[i].shape, dx, dy);
    }

    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
      for (let i = 0; i < shapeStates.length; i += 1) {
        if (!shapeStates[i].dirty) continue;
        shapeStates[i].shape = getCachedCollisionShapeForThing(
          things[i],
          blueprintLookup
        );
        shapeStates[i].dirty = false;
      }

      const grid = buildSpatialHashGrid(
        shapeStates,
        suspendedFlags,
        SPATIAL_HASH_CELL_SIZE
      );
      const processedPairs = new Set<number>();
      const thingCount = things.length;

      let resolvedAny = false;
      for (const indices of grid.values()) {
        if (indices.length < 2) continue;
        for (let indexA = 0; indexA < indices.length; indexA += 1) {
          const i = indices[indexA];
          for (let indexB = indexA + 1; indexB < indices.length; indexB += 1) {
            const j = indices[indexB];
            const key = i < j ? i * thingCount + j : j * thingCount + i;
            if (processedPairs.has(key)) continue;
            processedPairs.add(key);
            const resolved = resolveCollision(
              things[i],
              things[j],
              shapeStates,
              materials,
              i,
              j,
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
  shapeStates: CollisionShapeState[],
  materials: PhysicsMaterial[],
  indexA: number,
  indexB: number,
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

  const shapeA = getCachedCollisionShape(
    a,
    shapeStates[indexA],
    blueprintLookup
  );
  const shapeB = getCachedCollisionShape(
    b,
    shapeStates[indexB],
    blueprintLookup
  );
  if (!aabbsOverlap(shapeA.aabb, shapeB.aabb)) {
    return false;
  }
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
      shapeStates[indexA].dirty = true;
      shapeStates[indexB].dirty = true;
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
      shapeStates[indexA].dirty = true;
      shapeStates[indexB].dirty = true;
    }
    return true;
  }

  const materialA = materials[indexA];
  const materialB = materials[indexB];
  const invMassA = canMoveA ? materialA.invMass : 0;
  const invMassB = canMoveB ? materialB.invMass : 0;
  const totalInvMass = invMassA + invMassB;

  if (totalInvMass > 0) {
    applyPositionCorrection(
      a,
      b,
      shapeA,
      shapeB,
      collisionNormal,
      mtv.overlap,
      invMassA,
      invMassB
    );

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
    shapeStates[indexA].dirty = true;
    shapeStates[indexB].dirty = true;
  }

  return true;
}

function computeSubsteps(
  things: RuntimeThing[],
  suspendedThingIds: ReadonlySet<string>
): number {
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

function buildSpatialHashGrid(
  shapeStates: CollisionShapeState[],
  suspendedFlags: boolean[],
  cellSize: number
): Map<string, number[]> {
  const cells = new Map<string, number[]>();

  for (let i = 0; i < shapeStates.length; i += 1) {
    if (suspendedFlags[i]) continue;
    const aabb = shapeStates[i].shape.aabb;
    if (
      !Number.isFinite(aabb.minX) ||
      !Number.isFinite(aabb.maxX) ||
      !Number.isFinite(aabb.minY) ||
      !Number.isFinite(aabb.maxY)
    ) {
      continue;
    }

    const minCellX = Math.floor(aabb.minX / cellSize);
    const maxCellX = Math.floor(aabb.maxX / cellSize);
    const minCellY = Math.floor(aabb.minY / cellSize);
    const maxCellY = Math.floor(aabb.maxY / cellSize);

    for (let x = minCellX; x <= maxCellX; x += 1) {
      for (let y = minCellY; y <= maxCellY; y += 1) {
        const key = `${x},${y}`;
        const bucket = cells.get(key);
        if (bucket) {
          bucket.push(i);
        } else {
          cells.set(key, [i]);
        }
      }
    }
  }

  return cells;
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
  return Math.max(a, b);
}

function applyPositionCorrection(
  a: RuntimeThing,
  b: RuntimeThing,
  shapeA: CachedCollisionShape,
  shapeB: CachedCollisionShape,
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
    const dx = -correction.x * invMassA;
    const dy = -correction.y * invMassA;
    a.x += dx;
    a.y += dy;
    translateCollisionShape(shapeA, dx, dy);
  }
  if (invMassB > 0) {
    const dx = correction.x * invMassB;
    const dy = correction.y * invMassB;
    b.x += dx;
    b.y += dy;
    translateCollisionShape(shapeB, dx, dy);
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
  const normalVelocity =
    thing.velocityX * normal.x + thing.velocityY * normal.y;
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
    (handler) => handler(a, b, game),
    { otherThing: b }
  );
  runBlueprintHandlers(
    "collision",
    blueprintB,
    blueprintB?.collision,
    (handler) => handler(b, a, game),
    { otherThing: a }
  );
}

function getCachedCollisionShape(
  thing: RuntimeThing,
  shapeState: CollisionShapeState,
  blueprintLookup: Map<string, Blueprint>
): CachedCollisionShape {
  if (shapeState.dirty) {
    shapeState.shape = getCachedCollisionShapeForThing(thing, blueprintLookup);
    shapeState.dirty = false;
  }
  return shapeState.shape;
}

function getCachedCollisionShapeForThing(
  thing: RuntimeThing,
  blueprintLookup: Map<string, Blueprint>
): CachedCollisionShape {
  const shape = getShapeForThing(thing, blueprintLookup);

  if (shape === "circle") {
    const radius = thing.width / 2;
    const center = {
      x: thing.x + thing.width / 2,
      y: thing.y + thing.height / 2,
    };
    return { kind: "circle", center, radius, aabb: computeCircleAabb(center, radius) };
  }

  const { points, center } = buildPolygonPointsAndCenter(thing, shape);
  const axes = getAxes(points);
  const aabb = computePolygonAabb(points);

  return { kind: "polygon", points, center, axes, aabb };
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

  const { points, center } = buildPolygonPointsAndCenter(thing, shape);

  return { kind: "polygon", points, center };
}

function buildPolygonPointsAndCenter(
  thing: RuntimeThing,
  shape: Exclude<Shape, "circle">
): { points: Vector[]; center: Vector } {
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

  return { points, center: computeCentroid(points) };
}

function translateCollisionShape(
  shape: CachedCollisionShape,
  dx: number,
  dy: number
): void {
  shape.center.x += dx;
  shape.center.y += dy;
  shape.aabb.minX += dx;
  shape.aabb.maxX += dx;
  shape.aabb.minY += dy;
  shape.aabb.maxY += dy;
  if (shape.kind === "polygon") {
    for (const point of shape.points) {
      point.x += dx;
      point.y += dy;
    }
  }
}

function computePolygonAabb(points: Vector[]): Aabb {
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function computeCircleAabb(center: Vector, radius: number): Aabb {
  return {
    minX: center.x - radius,
    maxX: center.x + radius,
    minY: center.y - radius,
    maxY: center.y + radius,
  };
}

function aabbsOverlap(a: Aabb, b: Aabb): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
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

function getPolygonAxes(shape: PolygonCollisionShape): Vector[] {
  if (shape.axes) {
    return shape.axes;
  }
  const axes = getAxes(shape.points);
  shape.axes = axes;
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

  let smallestAxis: Vector | null = null;
  let smallestOverlap = Infinity;

  const testAxis = (axis: Vector) => {
    const projectionA = projectShape(shapeA, axis);
    const projectionB = projectShape(shapeB, axis);
    const overlap =
      Math.min(projectionA.max, projectionB.max) -
      Math.max(projectionA.min, projectionB.min);
    if (overlap <= 0) {
      return false;
    }
    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      smallestAxis = axis;
    }
    return true;
  };

  if (shapeA.kind === "polygon") {
    for (const axis of getPolygonAxes(shapeA)) {
      if (!testAxis(axis)) {
        return null;
      }
    }
  }

  if (shapeB.kind === "polygon") {
    for (const axis of getPolygonAxes(shapeB)) {
      if (!testAxis(axis)) {
        return null;
      }
    }
  }

  if (shapeA.kind === "circle" && shapeB.kind === "polygon") {
    const axis = getCircleToPolygonAxis(shapeA, shapeB);
    if (axis && !testAxis(axis)) {
      return null;
    }
  } else if (shapeB.kind === "circle" && shapeA.kind === "polygon") {
    const axis = getCircleToPolygonAxis(shapeB, shapeA);
    if (axis && !testAxis(axis)) {
      return null;
    }
  }

  if (!smallestAxis || !Number.isFinite(smallestOverlap)) {
    return null;
  }

  return { axis: smallestAxis, overlap: smallestOverlap };
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

  return {
    axis: { x: offset.x / distance, y: offset.y / distance },
    overlap: radiusSum - distance,
  };
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

  const closestOnPolygon = getClosestPointOnPolygon(
    polygon.points,
    circle.center
  );
  const toPolygon = {
    x: closestOnPolygon.x - circle.center.x,
    y: closestOnPolygon.y - circle.center.y,
  };
  const distanceToPolygon = Math.hypot(toPolygon.x, toPolygon.y);
  const direction =
    distanceToPolygon === 0
      ? { x: 1, y: 0 }
      : {
          x: toPolygon.x / distanceToPolygon,
          y: toPolygon.y / distanceToPolygon,
        };
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

function computeCentroid(points: Vector[]): Vector {
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  return { x: sumX / points.length, y: sumY / points.length };
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
