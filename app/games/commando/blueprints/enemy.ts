import {
  BlueprintData,
  GameContext,
  RuntimeThing,
  KeyState,
} from "@/engine/types";
import { canBulletPassWall } from "./bullet";

const PLAYER_BLUEPRINT = "player";
const ENEMY_BLUEPRINT = "enemy";
const BULLET_BLUEPRINT = "bullet";
const WALL_BLUEPRINT = "wall";

export default function createBlueprint4(data: BlueprintData) {
  const lastFireTimes = new Map<string, number>();
  const FIRE_INTERVAL_MS = 1000;
  const BULLET_SPEED = 4;
  const TURN_SPEED = 1;
  const AIM_TOLERANCE_DEGREES = 5;

  return {
    ...data,
    input: (thing: RuntimeThing, _game: GameContext, _keys: KeyState) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
    },
    update: (thing: RuntimeThing, game: GameContext) => {
      const things = game.gameState.things;
      const player = findPlayer(things);
      if (!player) {
        return;
      }

      const targetDirection = directionToThing(thing, player);
      const desiredAngle = vectorToAngle(targetDirection);
      thing.angle = turnTowardsAngle(thing.angle, desiredAngle, TURN_SPEED);
      const now = Date.now();
      const lastFired = lastFireTimes.get(thing.id) ?? 0;

      const isAimedAtPlayer =
        Math.abs(getAngleDelta(thing.angle, desiredAngle)) <=
        AIM_TOLERANCE_DEGREES;
      const firingDirection = angleToVector(thing.angle);
      const hasClearShot = hasLineOfSight({
        source: thing,
        target: player,
        allThings: things,
        firingDirection,
      });
      if (
        !isAimedAtPlayer ||
        !hasClearShot ||
        now - lastFired < FIRE_INTERVAL_MS
      ) {
        return;
      }

      const bulletBlueprint = game.gameState.blueprints.find(
        (bp) => bp.name === BULLET_BLUEPRINT
      );
      if (!bulletBlueprint) {
        return;
      }
      const origin = getThingCenter(thing);
      const spawnOffset =
        Math.max(thing.width, thing.height) / 2 + bulletBlueprint.height / 2;
      const spawnPoint = {
        x: origin.x + firingDirection.x * spawnOffset,
        y: origin.y + firingDirection.y * spawnOffset,
      };
      const spawned = game.spawn({
        blueprint: BULLET_BLUEPRINT,
        position: spawnPoint,
        overrides: {
          velocityX: firingDirection.x * BULLET_SPEED,
          velocityY: firingDirection.y * BULLET_SPEED,
          angle: thing.angle,
          data: { shooterId: thing.id },
        },
      });
      if (spawned) {
        lastFireTimes.set(thing.id, now);
      }
    },
  };
}

function findPlayer(things: ReadonlyArray<RuntimeThing>) {
  return things.find(
    (candidate) => candidate.blueprintName === PLAYER_BLUEPRINT
  );
}

function getThingCenter(thing: RuntimeThing) {
  return { x: thing.x + thing.width / 2, y: thing.y + thing.height / 2 };
}

function directionToThing(from: RuntimeThing, to: RuntimeThing) {
  const source = getThingCenter(from);
  const target = getThingCenter(to);
  const vector = { x: target.x - source.x, y: target.y - source.y };
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function vectorToAngle(vector: { x: number; y: number }) {
  return (Math.atan2(vector.x, -vector.y) * 180) / Math.PI;
}

function angleToVector(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function turnTowardsAngle(
  currentAngle: number,
  targetAngle: number,
  maxDelta: number
) {
  const delta = getAngleDelta(currentAngle, targetAngle);
  const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));
  return normalizeAngle(currentAngle + clampedDelta);
}

function getAngleDelta(from: number, to: number) {
  const normalizedFrom = normalizeAngle(from);
  const normalizedTo = normalizeAngle(to);
  const delta = normalizedTo - normalizedFrom;
  const wrapped = ((delta + 540) % 360) - 180;
  return wrapped;
}

function normalizeAngle(angle: number) {
  const wrapped = angle % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function hasLineOfSight({
  source,
  target,
  allThings,
  firingDirection,
}: {
  source: RuntimeThing;
  target: RuntimeThing;
  allThings: ReadonlyArray<RuntimeThing>;
  firingDirection: { x: number; y: number };
}) {
  const start = getThingCenter(source);
  const end = getThingCenter(target);
  return !allThings.some((candidate) => {
    if (candidate.id === source.id || candidate.id === target.id) {
      return false;
    }
    if (candidate.blueprintName === WALL_BLUEPRINT) {
      return (
        !canBulletPassWall({
          wall: candidate,
          bulletDirection: firingDirection,
          subject: source,
        }) && lineIntersectsRect(start, end, getBounds(candidate))
      );
    }
    if (candidate.blueprintName !== ENEMY_BLUEPRINT) {
      return false;
    }
    const bounds = getBounds(candidate);
    return lineIntersectsRect(start, end, bounds);
  });
}

function getBounds(thing: RuntimeThing) {
  return {
    minX: thing.x,
    maxX: thing.x + thing.width,
    minY: thing.y,
    maxY: thing.y + thing.height,
  };
}

function lineIntersectsRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
  rect: { minX: number; maxX: number; minY: number; maxY: number }
) {
  if (pointInsideRect(start, rect) || pointInsideRect(end, rect)) {
    return true;
  }

  const topLeft = { x: rect.minX, y: rect.minY };
  const topRight = { x: rect.maxX, y: rect.minY };
  const bottomLeft = { x: rect.minX, y: rect.maxY };
  const bottomRight = { x: rect.maxX, y: rect.maxY };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function pointInsideRect(
  point: { x: number; y: number },
  rect: { minX: number; maxX: number; minY: number; maxY: number }
) {
  return (
    point.x >= rect.minX &&
    point.x <= rect.maxX &&
    point.y >= rect.minY &&
    point.y <= rect.maxY
  );
}

function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
) {
  const d1 = direction(a1, a2, b1);
  const d2 = direction(a1, a2, b2);
  const d3 = direction(b1, b2, a1);
  const d4 = direction(b1, b2, a2);

  if (d1 === 0 && onSegment(a1, b1, a2)) return true;
  if (d2 === 0 && onSegment(a1, b2, a2)) return true;
  if (d3 === 0 && onSegment(b1, a1, b2)) return true;
  if (d4 === 0 && onSegment(b1, a2, b2)) return true;

  return d1 * d2 < 0 && d3 * d4 < 0;
}

function direction(
  from: { x: number; y: number },
  to: { x: number; y: number },
  point: { x: number; y: number }
) {
  return (
    (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)
  );
}

function onSegment(
  start: { x: number; y: number },
  point: { x: number; y: number },
  end: { x: number; y: number }
) {
  return (
    Math.min(start.x, end.x) <= point.x &&
    point.x <= Math.max(start.x, end.x) &&
    Math.min(start.y, end.y) <= point.y &&
    point.y <= Math.max(start.y, end.y)
  );
}
