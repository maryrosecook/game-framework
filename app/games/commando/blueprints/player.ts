import {
  BlueprintData,
  RuntimeGameState,
  KeyState,
  RuntimeThing,
  UpdateContext,
} from "@/engine/types";
import { createThingFromBlueprint } from "@/engine/blueprints";
import { createThingProxy } from "@/engine/proxy";

const MOVE_SPEED = 1.5;
const TURN_SPEED = 2;
const BULLET_SPEED = 5;
const FIRE_COOLDOWN_MS = 200;

const lastFireTimes = new Map<string, number>();

export default function createPlayerBlueprint(data: BlueprintData) {
  return {
    ...data,
    input: (
      thing: RuntimeThing,
      gameState: RuntimeGameState,
      keys: KeyState
    ) => {
      thing.velocityX = 0;
      thing.velocityY = 0;

      if (keys.arrowLeft) {
        thing.angle -= TURN_SPEED;
      }
      if (keys.arrowRight) {
        thing.angle += TURN_SPEED;
      }

      const direction = angleToVector(thing.angle);
      if (keys.arrowUp) {
        thing.velocityX += direction.x * MOVE_SPEED;
        thing.velocityY += direction.y * MOVE_SPEED;
      }
      if (keys.arrowDown) {
        thing.velocityX -= direction.x * MOVE_SPEED;
        thing.velocityY -= direction.y * MOVE_SPEED;
      }

      if (keys.space) {
        spawnBullet(thing, gameState, direction);
      }
    },
    update: ({ thing }: UpdateContext) => {
      // Slight damping to make the player feel less slippery.
      thing.velocityX *= 0.95;
      thing.velocityY *= 0.95;
    },
    collision: (
      thing: RuntimeThing,
      _other: RuntimeThing,
      _gameState: RuntimeGameState
    ) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
    },
  };
}

function angleToVector(angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

function spawnBullet(
  thing: RuntimeThing,
  gameState: RuntimeGameState,
  direction: { x: number; y: number }
) {
  const now = Date.now();
  const lastTime = lastFireTimes.get(thing.id) ?? 0;
  if (now - lastTime < FIRE_COOLDOWN_MS) {
    return;
  }

  const bulletBlueprint = gameState.blueprints.find(
    (bp) => bp.name === "bullet"
  );
  if (!bulletBlueprint) {
    return;
  }

  const origin = {
    x: thing.x + thing.width / 2,
    y: thing.y + thing.height / 2,
  };
  const spawnOffset =
    Math.max(thing.width, thing.height) / 2 + bulletBlueprint.height / 2;
  const spawnPoint = {
    x: origin.x + direction.x * spawnOffset,
    y: origin.y + direction.y * spawnOffset,
  };

  const bulletRaw = createThingFromBlueprint(bulletBlueprint, spawnPoint, {
    velocityX: direction.x * BULLET_SPEED,
    velocityY: direction.y * BULLET_SPEED,
    angle: thing.angle,
  });
  const bullet = createThingProxy(
    bulletRaw,
    new Map([[bulletBlueprint.name, bulletBlueprint]])
  );
  gameState.things = [...gameState.things, bullet];
  lastFireTimes.set(thing.id, now);
}
