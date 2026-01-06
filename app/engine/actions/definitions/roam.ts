import { ActionDefinition, GameContext, RuntimeThing, Vector } from "@/engine/types";

const allowedTriggers: ActionDefinition<"update">["allowedTriggers"] = [
  "update",
];

const TARGET_ATTEMPTS = 8;
const MIN_TARGET_DISTANCE = 8;

const roamTargets = new Map<string, Vector>();

const roam: ActionDefinition<
  "update",
  {
    speed: { kind: "number"; default: number; min: number; step: number };
    arriveDistance: { kind: "number"; default: number; min: number; step: number };
  }
> = {
  allowedTriggers,
  settings: {
    speed: { kind: "number", default: 2, min: 0, step: 0.1 },
    arriveDistance: { kind: "number", default: 8, min: 0, step: 1 },
  },
  code: ({ thing, game, settings }) => {
    const center = getThingCenter(thing);
    const target = getOrCreateTarget(
      thing,
      game,
      center,
      Math.max(0, settings.arriveDistance)
    );
    const offset = { x: target.x - center.x, y: target.y - center.y };
    const distance = Math.hypot(offset.x, offset.y);

    if (distance === 0) {
      thing.velocityX = 0;
      thing.velocityY = 0;
      return;
    }

    const direction = { x: offset.x / distance, y: offset.y / distance };
    thing.velocityX = direction.x * settings.speed;
    thing.velocityY = direction.y * settings.speed;
    thing.angle = radiansToDegrees(Math.atan2(direction.x, -direction.y));
  },
};

export default roam;

function getThingCenter(thing: RuntimeThing): Vector {
  return {
    x: thing.x + thing.width / 2,
    y: thing.y + thing.height / 2,
  };
}

function getOrCreateTarget(
  thing: RuntimeThing,
  game: GameContext,
  center: Vector,
  arriveDistance: number
): Vector {
  const existing = roamTargets.get(thing.id);
  if (existing && distanceBetween(center, existing) > arriveDistance) {
    return existing;
  }

  const minDistance = Math.max(arriveDistance, MIN_TARGET_DISTANCE);
  const nextTarget = pickTarget(thing, game, center, minDistance);
  roamTargets.set(thing.id, nextTarget);
  return nextTarget;
}

function pickTarget(
  thing: RuntimeThing,
  game: GameContext,
  center: Vector,
  minDistance: number
): Vector {
  const screen = game.gameState.screen;
  const camera = game.gameState.camera;
  const xRange = getScreenRange(camera.x, screen.width, thing.width);
  const yRange = getScreenRange(camera.y, screen.height, thing.height);

  if (xRange.min === xRange.max && yRange.min === yRange.max) {
    return { x: xRange.min, y: yRange.min };
  }

  let candidate = randomPoint(xRange, yRange);
  for (let attempt = 0; attempt < TARGET_ATTEMPTS; attempt += 1) {
    if (distanceBetween(center, candidate) >= minDistance) {
      return candidate;
    }
    candidate = randomPoint(xRange, yRange);
  }

  return candidate;
}

function getScreenRange(
  cameraStart: number,
  screenSize: number,
  thingSize: number
): { min: number; max: number } {
  const halfThing = thingSize / 2;
  if (screenSize <= thingSize) {
    const center = cameraStart + screenSize / 2;
    return { min: center, max: center };
  }
  return {
    min: cameraStart + halfThing,
    max: cameraStart + screenSize - halfThing,
  };
}

function randomPoint(
  xRange: { min: number; max: number },
  yRange: { min: number; max: number }
): Vector {
  return {
    x: randomBetween(xRange.min, xRange.max),
    y: randomBetween(yRange.min, yRange.max),
  };
}

function randomBetween(min: number, max: number): number {
  if (min === max) {
    return min;
  }
  return min + Math.random() * (max - min);
}

function distanceBetween(a: Vector, b: Vector): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
