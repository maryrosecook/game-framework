import {
  BlueprintData,
  RuntimeGameState,
  RuntimeThing,
  KeyState,
} from "@/engine/types";
import { createThingFromBlueprint } from "@/engine/blueprints";

const PLAYER_SPEED = 3;
const BULLET_SPEED = 6;
const FIRE_COOLDOWN_MS = 200;
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

export default function createBlueprint3(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, state: RuntimeGameState, keys: KeyState) => {
      const horizontal = (keys.arrowRight ? 1 : 0) - (keys.arrowLeft ? 1 : 0);
      const vertical = (keys.arrowDown ? 1 : 0) - (keys.arrowUp ? 1 : 0);

      let movementDirection: { x: number; y: number } | null = null;
      const magnitude = Math.hypot(horizontal, vertical);
      if (magnitude === 0) {
        thing.velocityX = 0;
        thing.velocityY = 0;
      } else {
        const normalized = {
          x: horizontal / magnitude,
          y: vertical / magnitude,
        };
        const cardinal = quantizeToCardinal(normalized);
        if (cardinal) {
          lastMoveDirections.set(thing.id, cardinal);
          movementDirection = cardinal;
        }
        thing.velocityX = normalized.x * PLAYER_SPEED;
        thing.velocityY = normalized.y * PLAYER_SPEED;
      }

      if (keys.digit0) {
        spawnBullet(thing, state, movementDirection);
      }
    },
    update: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
      _things: RuntimeThing[]
    ) => {
      return thing;
    },
    render: (
      thing: RuntimeThing,
      _state: RuntimeGameState,
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
  state: RuntimeGameState,
  movementDirection: { x: number; y: number } | null
) {
  const now = Date.now();
  const lastTime = lastFireTimes.get(thing.id) ?? 0;
  if (now - lastTime < FIRE_COOLDOWN_MS) return;

  const bulletBlueprint = state.blueprints.find((bp) => bp.name === "bullet-1");
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

  const bullet = createThingFromBlueprint(bulletBlueprint, spawnPoint, {
    velocityX: direction.x * BULLET_SPEED,
    velocityY: direction.y * BULLET_SPEED,
    angle: vectorToAngle(direction),
  });

  state.things = [...state.things, bullet];
  lastFireTimes.set(thing.id, now);
}
