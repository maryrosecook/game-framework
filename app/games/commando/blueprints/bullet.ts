import {
  BlueprintData,
  GameContext,
  RuntimeThing,
  KeyState,
  Vector,
} from "@/engine/types";

const WALL_PROXIMITY_THRESHOLD = 5;
const PLAYER_BLUEPRINT = "player";
const ENEMY_BLUEPRINT = "enemy";
const BULLET_BLUEPRINT = "bullet";
const WALL_BLUEPRINT = "wall";

export default function createBlueprint3(data: BlueprintData) {
  return {
    ...data,
    input: (
      thing: RuntimeThing,
      _game: GameContext,
      _keys: KeyState
    ) => {
      return thing;
    },
    update: () => {},
    collision: (
      thing: RuntimeThing,
      other: RuntimeThing,
      game: GameContext
    ) => {
      if (isBullet(other)) {
        return;
      }
      const direction = normalizeVector({
        x: thing.velocityX,
        y: thing.velocityY,
      });
      if (
        isWall(other) &&
        canBulletPassWall({
          things: game.gameState.things,
          wall: other,
          bulletDirection: direction,
        })
      ) {
        return;
      }
      const targetIsCharacter = isCharacter(other);
      game.destroy(thing);
      if (targetIsCharacter) {
        game.destroy(other);
      }
    },
  };
}

function isCharacter(thing: RuntimeThing) {
  return (
    thing.blueprintName === PLAYER_BLUEPRINT ||
    thing.blueprintName === ENEMY_BLUEPRINT
  );
}

function isBullet(thing: RuntimeThing) {
  return thing.blueprintName === BULLET_BLUEPRINT;
}

function isWall(thing: RuntimeThing) {
  return thing.blueprintName === WALL_BLUEPRINT;
}

export function canBulletPassWall({
  things,
  wall,
  bulletDirection,
  player,
}: {
  things: ReadonlyArray<RuntimeThing>;
  wall: RuntimeThing;
  bulletDirection: Vector;
  player?: RuntimeThing;
}) {
  const playerThing =
    player ??
    things.find((candidate) => candidate.blueprintName === PLAYER_BLUEPRINT);

  if (!playerThing) {
    return false;
  }

  const direction = normalizeVector(bulletDirection);
  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  const frontPoint = getFrontPoint(playerThing);
  const nearestPoint = clampPointToThing(frontPoint, wall);
  const distanceToWall = Math.hypot(
    frontPoint.x - nearestPoint.x,
    frontPoint.y - nearestPoint.y
  );
  if (distanceToWall > WALL_PROXIMITY_THRESHOLD) {
    return false;
  }

  const facing = angleToVector(playerThing.angle);
  const playerCenter = getThingCenter(playerThing);
  const toWall = {
    x: nearestPoint.x - playerCenter.x,
    y: nearestPoint.y - playerCenter.y,
  };
  const toWallDirection =
    toWall.x === 0 && toWall.y === 0 ? facing : normalizeVector(toWall);
  if (dot(facing, toWallDirection) <= 0) {
    return false;
  }

  return dot(facing, direction) > 0;
}

function getThingCenter(thing: RuntimeThing) {
  return { x: thing.x + thing.width / 2, y: thing.y + thing.height / 2 };
}

function angleToVector(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function normalizeVector(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.x + a.y * b.y;
}

function getFrontPoint(player: RuntimeThing) {
  const center = getThingCenter(player);
  const radians = (player.angle * Math.PI) / 180;
  const offset = { x: 0, y: -player.height / 2 };
  const rotated = {
    x: offset.x * Math.cos(radians) - offset.y * Math.sin(radians),
    y: offset.x * Math.sin(radians) + offset.y * Math.cos(radians),
  };
  return {
    x: center.x + rotated.x,
    y: center.y + rotated.y,
  };
}

function clampPointToThing(point: { x: number; y: number }, thing: RuntimeThing) {
  const clampedX = clamp(point.x, thing.x, thing.x + thing.width);
  const clampedY = clamp(point.y, thing.y, thing.y + thing.height);
  return { x: clampedX, y: clampedY };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
