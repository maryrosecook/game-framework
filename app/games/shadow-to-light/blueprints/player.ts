import { BlueprintData, GameContext, RuntimeThing, KeyState, Vector } from "@/engine/types";

const PLAYER_SPEED = 3;
const BOAT_SPEED = 3;
const BULLET_SPEED = 6;
const FIRE_COOLDOWN_MS = 200;
const WATER_SURVIVAL_MS = 3000;
const DEFAULT_DIRECTION = { x: 0, y: -1 };
const CARDINAL_DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  normalize({ x: 1, y: -1 }),
  normalize({ x: 1, y: 1 }),
  normalize({ x: -1, y: 1 }),
  normalize({ x: -1, y: -1 }),
];

const lastMoveDirections = new Map<string, { x: number; y: number }>();
const lastFireTimes = new Map<string, number>();
const controllingBoatIds = new Map<string, string>();
const boatDriveDirections = new Map<string, Vector>();
const waterEntryTimes = new Map<string, number>();

export default function createBlueprint3(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, game: GameContext, keys: KeyState) => {
      const horizontal = (keys.arrowRight ? 1 : 0) - (keys.arrowLeft ? 1 : 0);
      const vertical = (keys.arrowDown ? 1 : 0) - (keys.arrowUp ? 1 : 0);
      const lookup = createThingLookup(game.gameState.things);
      const colliding = getCollidingThings(thing, game, lookup);
      const boat =
        colliding.find((candidate) => candidate?.blueprintName === "boat") ??
        null;

      let movementDirection: { x: number; y: number } | null = null;
      const magnitude = Math.hypot(horizontal, vertical);
      const normalized =
        magnitude === 0
          ? null
          : {
              x: horizontal / magnitude,
              y: vertical / magnitude,
            };
      const cardinal = normalized ? quantizeToCardinal(normalized) : null;
      if (cardinal) {
        lastMoveDirections.set(thing.id, cardinal);
        movementDirection = cardinal;
      }

      const isControllingBoat = !!boat && keys.digit9;
      if (isControllingBoat) {
        controllingBoatIds.set(thing.id, boat.id);
        boatDriveDirections.set(thing.id, normalized ?? { x: 0, y: 0 });
        thing.velocityX = 0;
        thing.velocityY = 0;
      } else {
        const lastBoatId = controllingBoatIds.get(thing.id);
        const lastBoat =
          (lastBoatId && lookup.get(lastBoatId)) || boat || null;
        if (lastBoat) {
          lastBoat.velocityX = 0;
          lastBoat.velocityY = 0;
        }
        controllingBoatIds.delete(thing.id);
        boatDriveDirections.delete(thing.id);
        if (magnitude === 0 || !normalized) {
          thing.velocityX = 0;
          thing.velocityY = 0;
        } else {
          thing.velocityX = normalized.x * PLAYER_SPEED;
          thing.velocityY = normalized.y * PLAYER_SPEED;
        }
      }

      if (keys.digit0) {
        spawnBullet(thing, game, movementDirection);
      }
    },
    update: (thing: RuntimeThing, game: GameContext) => {
      const lookup = createThingLookup(game.gameState.things);
      const colliding = getCollidingThings(thing, game, lookup);
      const boat =
        colliding.find((candidate) => candidate?.blueprintName === "boat") ??
        null;
      const onWater = colliding.some(
        (candidate) => candidate?.blueprintName === "water"
      );
      const onBoat = !!boat;

      const drowned = handleDrowning(thing, onWater, onBoat, game);
      if (drowned) {
        return;
      }

      const targetBoatId = controllingBoatIds.get(thing.id);
      const targetBoat =
        (targetBoatId && lookup.get(targetBoatId)) || null;

      if (!targetBoat) {
        boatDriveDirections.delete(thing.id);
        controllingBoatIds.delete(thing.id);
        return;
      }

      const intendedDirection = boatDriveDirections.get(thing.id) ?? {
        x: 0,
        y: 0,
      };
      targetBoat.velocityX = intendedDirection.x * BOAT_SPEED;
      targetBoat.velocityY = intendedDirection.y * BOAT_SPEED;
      thing.velocityX = targetBoat.velocityX;
      thing.velocityY = targetBoat.velocityY;
      stickPlayerToBoat(thing, targetBoat);
    },
    render: (
      thing: RuntimeThing,
      _game: GameContext,
      ctx: CanvasRenderingContext2D
    ) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}

function quantizeToCardinal(vector: { x: number; y: number }) {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) return null;
  const normalized = { x: vector.x / magnitude, y: vector.y / magnitude };
  let best = CARDINAL_DIRECTIONS[0];
  let bestDot = -Infinity;
  for (const candidate of CARDINAL_DIRECTIONS) {
    const dot = normalized.x * candidate.x + normalized.y * candidate.y;
    if (dot > bestDot) {
      bestDot = dot;
      best = candidate;
    }
  }
  return best;
}

function vectorToAngle(vector: { x: number; y: number }) {
  return (Math.atan2(vector.x, -vector.y) * 180) / Math.PI;
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function spawnBullet(
  thing: RuntimeThing,
  game: GameContext,
  movementDirection: { x: number; y: number } | null
) {
  const now = Date.now();
  const lastTime = lastFireTimes.get(thing.id) ?? 0;
  if (now - lastTime < FIRE_COOLDOWN_MS) return;

  const bulletBlueprint = game.gameState.blueprints.find(
    (bp) => bp.name === "bullet-1"
  );
  if (!bulletBlueprint) return;

  const direction =
    movementDirection ??
    lastMoveDirections.get(thing.id) ??
    quantizeToCardinal({ x: thing.velocityX, y: thing.velocityY }) ??
    DEFAULT_DIRECTION;

  const origin = {
    x: thing.x + thing.width / 2,
    y: thing.y + thing.height / 2,
  };

  const spawnOffset = Math.sqrt(
    Math.pow((thing.width + bulletBlueprint.width) / 2, 2) +
      Math.pow((thing.height + bulletBlueprint.height) / 2, 2)
  );

  const spawnPoint = {
    x: origin.x + direction.x * spawnOffset,
    y: origin.y + direction.y * spawnOffset,
  };

  game.spawn({
    blueprint: bulletBlueprint,
    position: spawnPoint,
    overrides: {
      velocityX: direction.x * BULLET_SPEED,
      velocityY: direction.y * BULLET_SPEED,
      angle: vectorToAngle(direction),
    },
  });
  lastFireTimes.set(thing.id, now);
}

function getCollidingThings(
  thing: RuntimeThing,
  game: GameContext,
  lookup: Map<string, RuntimeThing>
) {
  const ids = game.collidingThingIds.get(thing.id) ?? [];
  return ids
    .map((id) => lookup.get(id))
    .filter((entry): entry is RuntimeThing => Boolean(entry));
}

function createThingLookup(things: RuntimeThing[]) {
  const lookup = new Map<string, RuntimeThing>();
  for (const entry of things) {
    lookup.set(entry.id, entry);
  }
  return lookup;
}

function stickPlayerToBoat(player: RuntimeThing, boat: RuntimeThing) {
  player.x = boat.x + boat.width / 2 - player.width / 2;
  player.y = boat.y + boat.height / 2 - player.height / 2;
}

function handleDrowning(
  thing: RuntimeThing,
  onWater: boolean,
  onBoat: boolean,
  game: GameContext
) {
  if (onWater && !onBoat) {
    const startedAt = waterEntryTimes.get(thing.id) ?? Date.now();
    waterEntryTimes.set(thing.id, startedAt);
    if (Date.now() - startedAt > WATER_SURVIVAL_MS) {
      game.destroy(thing);
      waterEntryTimes.delete(thing.id);
      boatDriveDirections.delete(thing.id);
      controllingBoatIds.delete(thing.id);
      return true;
    }
  } else {
    waterEntryTimes.delete(thing.id);
  }
  return false;
}
