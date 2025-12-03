import { defineBlueprint } from "@/engine/blueprints";
import { BlueprintData, GameContext, RuntimeThing, Vector } from "@/engine/types";
import { z } from "zod";
import {
  NavGrid,
  cellCenter,
  findPath,
  getNavigationGrid,
  getThingCenter,
  hasLineOfSight,
  worldToCell,
} from "../navigation";
import { TheseusBlueprint } from "./theseus";

const THESEUS_BLUEPRINT = "theseus";
const ROAM_RADIUS_CELLS = 8;
const ROAM_ATTEMPTS = 14;
const ROAM_PATH_REPLAN_MS = 1500;
const CHASE_PATH_REPLAN_MS = 250;
const ROAM_SPEED = 2.3;
const CHASE_SPEED = 3.6;
const WAYPOINT_REACHED_DISTANCE = 6;

const MinotaurDataSchema = z.object({
  path: z
    .array(z.object({ x: z.number(), y: z.number() }))
    .default([]),
  target: z.object({ x: z.number(), y: z.number() }).nullable().default(null),
  mode: z.enum(["roam", "chase"]).default("roam"),
  lastPlanTimestamp: z.number().default(0),
  lastGridSignature: z.string().nullable().default(null),
});

type MinotaurData = z.infer<typeof MinotaurDataSchema>;

const MinotaurBlueprintDefinition = defineBlueprint({
  name: "minotaur",
  schema: MinotaurDataSchema,
  create: (blueprintData) => ({
    ...blueprintData,
    input: (thing: RuntimeThing) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
    },
    update: (thing: RuntimeThing, game: GameContext) => {
      const state = ensureState(thing);

      const grid = getNavigationGrid(game.gameState, undefined, {
        x: thing.width / 2,
        y: thing.height / 2,
      });

      const theseus = game.gameState.things.find(TheseusBlueprint.isThing);
      if (!theseus) return;

      const center = getThingCenter(thing);
      const now = Date.now();

      // Chase branch when Theseus is visible.
      if (hasLineOfSight(thing, theseus, grid.obstacles)) {
        state.mode = "chase";
        state.target = getThingCenter(theseus);
        if (!ensurePlannedPath(state, grid, center, now)) {
          stopMovement(thing);
          return;
        }
        followPath(thing, state);
        return;
      }

      // Leave chase mode if Theseus is no longer visible.
      if (state.mode === "chase") {
        state.mode = "roam";
        state.target = null;
        state.path = [];
      }

      // Clear empty roam path.
      if (state.mode === "roam" && state.path.length === 0) {
        state.target = null;
      }

      // Acquire roam target.
      if (!state.target && state.mode === "roam") {
        const roamSelection = chooseRoamTarget(grid, center, ROAM_RADIUS_CELLS);
        if (!roamSelection) {
          stopMovement(thing);
          return;
        }
        state.target = roamSelection.target;
        state.path = trimPath(roamSelection.path);
        state.lastPlanTimestamp = now;
        state.lastGridSignature = grid.signature;
      }

      // Stop if no target is available.
      if (!state.target) {
        stopMovement(thing);
        return;
      }

      // Replan if needed, otherwise follow.
      if (!ensurePlannedPath(state, grid, center, now)) {
        stopMovement(thing);
        return;
      }
      followPath(thing, state);

      // Persist state on the thing itself so per-instance state survives without global maps.
      thing.data = state;
    },
    collision: (
      _thing: RuntimeThing,
      other: RuntimeThing,
      game: GameContext
    ) => {
      if (other.blueprintName !== THESEUS_BLUEPRINT) {
        return;
      }
      game.destroy(other);
    },
    render: (
      thing: RuntimeThing,
      _game: GameContext,
      ctx: CanvasRenderingContext2D
    ) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  }),
});

export const MinotaurBlueprint = MinotaurBlueprintDefinition;

export default function createMinotaurBlueprint(
  data: BlueprintData<MinotaurData>
) {
  return MinotaurBlueprintDefinition.createBlueprint(data);
}

function ensureState(thing: RuntimeThing): MinotaurData {
  const existingResult = MinotaurDataSchema.safeParse(thing.data);
  if (existingResult.success) {
    return existingResult.data;
  }

  const fresh: MinotaurData = {
    path: [],
    target: null,
    mode: "roam",
    lastPlanTimestamp: 0,
    lastGridSignature: null,
  };
  thing.data = fresh;
  return fresh;
}

function findTheseus(things: ReadonlyArray<RuntimeThing>) {
  return things.find((thing) => thing.blueprintName === THESEUS_BLUEPRINT);
}

function chooseRoamTarget(grid: NavGrid, origin: Vector, radiusCells: number) {
  const originCell = worldToCell(origin, grid);
  for (let i = 0; i < ROAM_ATTEMPTS; i += 1) {
    const offset = randomOffset(radiusCells);
    const candidateCell = {
      col: originCell.col + offset.x,
      row: originCell.row + offset.y,
    };
    if (!isWithinGrid(candidateCell, grid)) {
      continue;
    }
    const candidateTarget = cellCenter(candidateCell, grid);
    const path = findPath(grid, origin, candidateTarget);
    if (path) {
      return { target: candidateTarget, path };
    }
  }
  return null;
}

function randomOffset(radius: number) {
  return {
    x: randomInt(-radius, radius),
    y: randomInt(-radius, radius),
  };
}

function randomInt(min: number, max: number) {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function followPath(thing: RuntimeThing, state: MinotaurData) {
  if (!state.path.length) {
    stopMovement(thing);
    if (state.mode === "roam") {
      state.target = null;
    }
    return;
  }

  let next = state.path[0];
  const center = getThingCenter(thing);
  while (
    next &&
    Math.hypot(next.x - center.x, next.y - center.y) < WAYPOINT_REACHED_DISTANCE
  ) {
    state.path.shift();
    next = state.path[0];
  }

  if (!next) {
    stopMovement(thing);
    if (state.mode === "roam") {
      state.target = null;
    }
    return;
  }

  const dx = next.x - center.x;
  const dy = next.y - center.y;
  const distance = Math.hypot(dx, dy) || 1;
  const speed = state.mode === "chase" ? CHASE_SPEED : ROAM_SPEED;
  const direction = { x: dx / distance, y: dy / distance };

  thing.velocityX = direction.x * speed;
  thing.velocityY = direction.y * speed;
}

function stopMovement(thing: RuntimeThing) {
  thing.velocityX = 0;
  thing.velocityY = 0;
}

function trimPath(path: Vector[]) {
  return path.length > 0 ? path.slice(1) : path;
}

function isWithinGrid(cell: { col: number; row: number }, grid: NavGrid) {
  return (
    cell.col >= 0 &&
    cell.row >= 0 &&
    cell.col < grid.cols &&
    cell.row < grid.rows
  );
}

function ensurePlannedPath(
  state: MinotaurData,
  grid: NavGrid,
  origin: Vector,
  now: number
) {
  const needsPlan =
    state.lastGridSignature !== grid.signature ||
    state.path.length === 0 ||
    (state.mode === "chase" &&
      now - state.lastPlanTimestamp > CHASE_PATH_REPLAN_MS) ||
    (state.mode === "roam" &&
      now - state.lastPlanTimestamp > ROAM_PATH_REPLAN_MS);

  if (!needsPlan || !state.target) {
    return state.path.length > 0;
  }

  const plannedPath = findPath(grid, origin, state.target);
  if (!plannedPath) {
    state.target = null;
    state.path = [];
    return false;
  }

  state.path = trimPath(plannedPath);
  state.lastPlanTimestamp = now;
  state.lastGridSignature = grid.signature;
  return true;
}
