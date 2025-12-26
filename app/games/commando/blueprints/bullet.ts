import {
  BlueprintData,
  Blueprint,
  GameContext,
  RuntimeThing,
  KeyState,
  Vector,
} from "@/engine/types";
import { getClosestPointsBetweenThings } from "@/engine/physics";

const WALL_PROXIMITY_THRESHOLD = 20;
const PLAYER_BLUEPRINT = "player";
const ENEMY_BLUEPRINT = "enemy";
const BULLET_BLUEPRINT = "bullet";
const WALL_BLUEPRINT = "wall";

type BulletData = {
  shooterId?: string;
};

export default function createBlueprint3(data: BlueprintData<BulletData>) {
  return {
    ...data,
    collision: (
      thing: RuntimeThing<BulletData>,
      other: RuntimeThing,
      game: GameContext
    ) => {
      if (isBullet(other)) {
        return;
      }
      const shooter = getShooter(thing, game.gameState.things);
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
          subject: shooter,
          blueprints: game.gameState.blueprints,
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

function getShooter(
  thing: RuntimeThing<BulletData>,
  things: ReadonlyArray<RuntimeThing>
) {
  const shooterId = thing.data?.shooterId;
  if (!shooterId) {
    return undefined;
  }
  return things.find((candidate) => candidate.id === shooterId);
}

export function canBulletPassWall({
  things,
  wall,
  bulletDirection,
  subject,
  player,
  blueprints,
}: {
  things?: ReadonlyArray<RuntimeThing>;
  wall: RuntimeThing;
  bulletDirection: Vector;
  subject?: RuntimeThing;
  player?: RuntimeThing;
  blueprints?: Blueprint[];
}) {
  const referenceThing =
    subject ??
    player ??
    things?.find((candidate) => candidate.blueprintName === PLAYER_BLUEPRINT);

  if (!referenceThing) {
    return false;
  }

  const direction = normalizeVector(bulletDirection);
  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  const blueprintLookup = new Map(
    (blueprints ?? []).map((bp) => [bp.name, bp])
  );
  const nearest = getClosestPointsBetweenThings(
    referenceThing,
    wall,
    blueprintLookup
  );
  const distanceToWall = nearest.distance;
  if (distanceToWall > WALL_PROXIMITY_THRESHOLD) {
    return false;
  }

  const facing = angleToVector(referenceThing.angle);
  const toWall = {
    x: nearest.pointOnB.x - nearest.pointOnA.x,
    y: nearest.pointOnB.y - nearest.pointOnA.y,
  };
  const toWallDirection =
    toWall.x === 0 && toWall.y === 0 ? facing : normalizeVector(toWall);
  if (dot(facing, toWallDirection) <= 0) {
    return false;
  }

  return dot(facing, direction) > 0;
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
