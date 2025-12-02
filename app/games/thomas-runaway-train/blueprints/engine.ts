import {
  BlueprintData,
  GameContext,
  KeyState,
  RuntimeThing,
} from "@/engine/types";
import {
  TRACK_LANES,
  TrackLane,
  getLaneOffset,
} from "../obstacleApproach";

const laneByThingId = new Map<string, TrackLane>();
const lastSwitchTime = new Map<string, number>();
const LANE_SWITCH_COOLDOWN_MS = 120;

export default function createEngine(data: BlueprintData) {
  const baseSize = { width: data.width, height: data.height };
  const baseZ = data.z;

  return {
    ...data,
    input: (thing: RuntimeThing, game: GameContext, keys: KeyState) => {
      if (game.gameState.isPaused) return;

      const currentLane = laneByThingId.get(thing.id) ?? "center";
      const direction =
        keys.arrowLeft === keys.arrowRight
          ? 0
          : keys.arrowLeft
            ? -1
            : 1;
      if (direction === 0) return;

      const now = nowMs();
      const last = lastSwitchTime.get(thing.id) ?? 0;
      if (now - last < LANE_SWITCH_COOLDOWN_MS) {
        return;
      }

      const currentIndex = TRACK_LANES.indexOf(currentLane);
      const nextIndex = clamp(
        currentIndex + direction,
        0,
        TRACK_LANES.length - 1
      );
      const nextLane = TRACK_LANES[nextIndex] ?? currentLane;
      laneByThingId.set(thing.id, nextLane);
      lastSwitchTime.set(thing.id, now);
    },
    update: (thing: RuntimeThing, game: GameContext) => {
      const lane = laneByThingId.get(thing.id) ?? "center";
      laneByThingId.set(thing.id, lane);
      positionEngine(thing, game, lane, baseSize, baseZ);
    },
    render: (thing: RuntimeThing, _game: GameContext, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}

function positionEngine(
  thing: RuntimeThing,
  game: GameContext,
  lane: TrackLane,
  baseSize: { width: number; height: number },
  baseZ?: number
) {
  const screen = game.gameState.screen;
  const laneOffset = getLaneOffset(lane, screen.width);
  const centerX = screen.width / 2 + laneOffset;
  const targetY = screen.height * 0.9;

  thing.width = baseSize.width;
  thing.height = baseSize.height;
  thing.x = centerX - thing.width / 2;
  thing.y = targetY - thing.height / 2;
  thing.z = baseZ ?? thing.z;
  thing.velocityX = 0;
  thing.velocityY = 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
