import { createThingFromBlueprint } from "@/engine/blueprints";
import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";
import { normalizeName } from "@/engine/reducer";

export default function createBlueprint4(data: BlueprintData) {
  const lastFireTimes = new Map<string, number>();
  const FIRE_INTERVAL_MS = 1000;
  const BULLET_SPEED = 8;

  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, _keys: KeyState) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
    },
    update: (
      thing: RuntimeThing,
      gameState: RuntimeGameState,
      things: RuntimeThing[]
    ) => {
      const player = findPlayer(things);
      if (!player) {
        return thing;
      }

      const direction = directionToThing(thing, player);
      thing.angle = vectorToAngle(direction);

      const now = Date.now();
      const lastFired = lastFireTimes.get(thing.id) ?? 0;
      if (now - lastFired >= FIRE_INTERVAL_MS) {
        const bulletBlueprint = gameState.blueprints.find(
          (bp) => normalizeName(bp.name) === "bullet"
        );
        if (bulletBlueprint) {
          const origin = getThingCenter(thing);
          const spawnOffset =
            Math.max(thing.width, thing.height) / 2 +
            bulletBlueprint.height / 2;
          const spawnPoint = {
            x: origin.x + direction.x * spawnOffset,
            y: origin.y + direction.y * spawnOffset,
          };
          const bullet = createThingFromBlueprint(bulletBlueprint, spawnPoint, {
            velocityX: direction.x * BULLET_SPEED,
            velocityY: direction.y * BULLET_SPEED,
            angle: thing.angle,
          });
          gameState.things = [...gameState.things, bullet];
          lastFireTimes.set(thing.id, now);
        }
      }

      return thing;
    },
  };
}

function findPlayer(things: RuntimeThing[]) {
  return things.find(
    (candidate) => normalizeName(candidate.blueprintName) === "player"
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
