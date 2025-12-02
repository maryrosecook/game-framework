import { GameContext, RuntimeThing } from "@/engine/types";

export type TrackLane = "left" | "center" | "right";
export const TRACK_LANES: readonly TrackLane[] = [
  "left",
  "center",
  "right",
] as const;

type ApproachState = {
  depth: number;
  lane: TrackLane;
  lastUpdatedAt: number;
};

const START_DEPTH = -3;
const END_DEPTH = 0;
const APPROACH_SPEED_PER_MS = 0.0012;
const FAR_SCALE = 0.2;
const NEAR_SCALE = 2.4;
const HORIZON_Y_RATIO = 0.5;
const ARRIVAL_Y_RATIO = 0.82;
const TRACK_SPREAD_RATIO = 0.18;

const approachByThingId = new Map<string, ApproachState>();

const nowMs = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function initializeApproach(
  thing: RuntimeThing,
  game: GameContext,
  lane: TrackLane,
  baseSize: { width: number; height: number }
) {
  const timestamp = nowMs();
  approachByThingId.set(thing.id, {
    depth: START_DEPTH,
    lane,
    lastUpdatedAt: timestamp,
  });
  applyApproachTransform(thing, game, baseSize, lane, START_DEPTH);
}

export function advanceApproach(
  thing: RuntimeThing,
  game: GameContext,
  baseSize: { width: number; height: number }
): boolean {
  const previous = approachByThingId.get(thing.id) ?? {
    depth: START_DEPTH,
    lane: "center" as TrackLane,
    lastUpdatedAt: nowMs(),
  };
  const currentTime = nowMs();
  if (game.gameState.isPaused) {
    applyApproachTransform(thing, game, baseSize, previous.lane, previous.depth);
    approachByThingId.set(thing.id, {
      ...previous,
      lastUpdatedAt: currentTime,
    });
    return false;
  }
  const elapsed = currentTime - previous.lastUpdatedAt;
  const nextDepth = Math.min(
    END_DEPTH,
    previous.depth + elapsed * APPROACH_SPEED_PER_MS
  );

  if (nextDepth >= END_DEPTH) {
    approachByThingId.delete(thing.id);
    game.destroy(thing);
    return true;
  }

  applyApproachTransform(thing, game, baseSize, previous.lane, nextDepth);
  approachByThingId.set(thing.id, {
    depth: nextDepth,
    lane: previous.lane,
    lastUpdatedAt: currentTime,
  });
  return false;
}

function applyApproachTransform(
  thing: RuntimeThing,
  game: GameContext,
  baseSize: { width: number; height: number },
  lane: TrackLane,
  depth: number
) {
  const progress = clamp01((depth - START_DEPTH) / (END_DEPTH - START_DEPTH));
  const screen = game.gameState.screen;
  const laneOffset = getLaneOffset(lane, screen.width);
  const horizonY = screen.height * HORIZON_Y_RATIO;
  const arrivalY = screen.height * ARRIVAL_Y_RATIO;

  const centerX = screen.width / 2 + laneOffset * progress;
  const centerY = horizonY + (arrivalY - horizonY) * progress;
  const scale = FAR_SCALE + (NEAR_SCALE - FAR_SCALE) * progress;

  thing.width = baseSize.width * scale;
  thing.height = baseSize.height * scale;
  thing.x = centerX - thing.width / 2;
  thing.y = centerY - thing.height / 2;
  thing.z = depth;
}

export function getLaneOffset(lane: TrackLane, screenWidth: number) {
  const spread = screenWidth * TRACK_SPREAD_RATIO;
  if (lane === "left") return -spread;
  if (lane === "right") return spread;
  return 0;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
