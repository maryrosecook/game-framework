import {
  BlueprintData,
  GameContext,
  RuntimeThing,
  Vector,
} from "@/engine/types";
import {
  NavGrid,
  cellCenter,
  findPath,
  getNavigationGrid,
  getThingCenter,
  hasLineOfSight,
  worldToCell,
} from "../navigation";

const THESEUS_BLUEPRINT = "theseus";
const ROAM_RADIUS_CELLS = 8;
const ROAM_ATTEMPTS = 14;
const ROAM_PATH_REPLAN_MS = 1500;
const CHASE_PATH_REPLAN_MS = 250;
const ROAM_SPEED = 2.3;
const CHASE_SPEED = 3.6;
const WAYPOINT_REACHED_DISTANCE = 6;

type MinotaurState = {
  path: Vector[];
  target: Vector | null;
  mode: "roam" | "chase";
  lastPlanTimestamp: number;
  lastGridSignature: string | null;
};

const stateById = new Map<string, MinotaurState>();

export default function createMinotaurBlueprint(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing) => {
      thing.velocityX = 0;
      thing.velocityY = 0;
    },
    update: (thing: RuntimeThing, game: GameContext) => {
      const grid = getNavigationGrid(game.gameState, undefined, {
        x: thing.width / 2,
        y: thing.height / 2,
      });
      const state = getState(thing.id);
      const theseus = findTheseus(game.gameState.things);
      const center = getThingCenter(thing);
      const now = Date.now();

      // No Theseus available to chase.
      if (!theseus) {
        stopMovement(thing);
        return;
      }

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
  };
}

function getState(id: string): MinotaurState {
  const existing = stateById.get(id);
  if (existing) return existing;
  const fresh: MinotaurState = {
    path: [],
    target: null,
    mode: "roam",
    lastPlanTimestamp: 0,
    lastGridSignature: null,
  };
  stateById.set(id, fresh);
  return fresh;
}

function findTheseus(things: ReadonlyArray<RuntimeThing>) {
  return things.find((thing) => thing.blueprintName === THESEUS_BLUEPRINT);
}

function chooseRoamTarget(
  grid: NavGrid,
  origin: Vector,
  radiusCells: number
) {
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

function followPath(thing: RuntimeThing, state: MinotaurState) {
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
    Math.hypot(next.x - center.x, next.y - center.y) <
      WAYPOINT_REACHED_DISTANCE
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
  state: MinotaurState,
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
