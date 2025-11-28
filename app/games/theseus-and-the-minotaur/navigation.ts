import { RuntimeGameState, RuntimeThing, Vector } from "@/engine/types";

type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export type NavGrid = {
  origin: Vector;
  cellSize: number;
  cols: number;
  rows: number;
  blocked: Set<string>;
  obstacles: Rect[];
  signature: string;
  padding: Vector;
};

type Cell = { col: number; row: number };

const DEFAULT_CELL_SIZE = 60;
const DEFAULT_PADDING: Vector = { x: 0, y: 0 };

let cachedGrid: NavGrid | null = null;
let cachedSignature: string | null = null;

export function getNavigationGrid(
  gameState: RuntimeGameState,
  cellSize: number = DEFAULT_CELL_SIZE,
  padding: Vector = DEFAULT_PADDING
): NavGrid {
  const signature = createGridSignature(gameState, cellSize, padding);
  if (cachedGrid && cachedSignature === signature) {
    return cachedGrid;
  }

  const grid = buildGrid(gameState, cellSize, padding, signature);
  cachedGrid = grid;
  cachedSignature = signature;
  return grid;
}

export function findPath(
  grid: NavGrid,
  start: Vector,
  goal: Vector
): Vector[] | null {
  const startCell = clampCellToBounds(worldToCell(start, grid), grid);
  const goalCell = clampCellToBounds(worldToCell(goal, grid), grid);
  const openStart = findNearestOpenCell(startCell, grid);
  const openGoal = findNearestOpenCell(goalCell, grid);
  if (!openStart || !openGoal) {
    return null;
  }

  const openSet: Cell[] = [openStart];
  const cameFrom = new Map<string, Cell>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  const startKey = cellKey(openStart);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(openStart, openGoal));

  while (openSet.length > 0) {
    openSet.sort(
      (a, b) =>
        (fScore.get(cellKey(a)) ?? Infinity) -
        (fScore.get(cellKey(b)) ?? Infinity)
    );
    const current = openSet.shift()!;
    if (cellsEqual(current, openGoal)) {
      return reconstructPath(current, cameFrom, grid);
    }

    for (const neighbor of neighbors(current, grid)) {
      const neighborKey = cellKey(neighbor);
      const tentativeG = (gScore.get(cellKey(current)) ?? Infinity) + 1;
      if (tentativeG >= (gScore.get(neighborKey) ?? Infinity)) {
        continue;
      }
      cameFrom.set(neighborKey, current);
      gScore.set(neighborKey, tentativeG);
      fScore.set(neighborKey, tentativeG + heuristic(neighbor, openGoal));
      if (!openSet.some((cell) => cellsEqual(cell, neighbor))) {
        openSet.push(neighbor);
      }
    }
  }

  return null;
}

export function hasLineOfSight(
  from: RuntimeThing,
  to: RuntimeThing,
  obstacles: Rect[]
) {
  const start = getThingCenter(from);
  const end = getThingCenter(to);
  return !obstacles.some((rect) => segmentsIntersectRect(start, end, rect));
}

export function getThingCenter(thing: RuntimeThing): Vector {
  return { x: thing.x + thing.width / 2, y: thing.y + thing.height / 2 };
}

export function worldToCell(point: Vector, grid: NavGrid): Cell {
  return {
    col: Math.floor((point.x - grid.origin.x) / grid.cellSize),
    row: Math.floor((point.y - grid.origin.y) / grid.cellSize),
  };
}

export function cellCenter(cell: Cell, grid: NavGrid): Vector {
  return {
    x: grid.origin.x + (cell.col + 0.5) * grid.cellSize,
    y: grid.origin.y + (cell.row + 0.5) * grid.cellSize,
  };
}

function buildGrid(
  gameState: RuntimeGameState,
  cellSize: number,
  padding: Vector,
  signature: string
): NavGrid {
  const obstacles = getStaticObstacles(gameState);
  const inflatedObstacles = obstacles.map((rect) =>
    inflateRect(rect, padding)
  );
  const bounds = computeWorldBounds(gameState);
  const origin = {
    x: Math.floor(bounds.minX / cellSize) * cellSize,
    y: Math.floor(bounds.minY / cellSize) * cellSize,
  };
  const maxXAligned = Math.ceil(bounds.maxX / cellSize) * cellSize;
  const maxYAligned = Math.ceil(bounds.maxY / cellSize) * cellSize;
  const cols = Math.max(1, Math.ceil((maxXAligned - origin.x) / cellSize));
  const rows = Math.max(1, Math.ceil((maxYAligned - origin.y) / cellSize));
  const blocked = new Set<string>();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellRect = {
        minX: origin.x + col * cellSize,
        maxX: origin.x + (col + 1) * cellSize,
        minY: origin.y + row * cellSize,
        maxY: origin.y + (row + 1) * cellSize,
      };
      const intersectsObstacle = inflatedObstacles.some((rect) =>
        rectsOverlap(cellRect, rect)
      );
      if (intersectsObstacle) {
        blocked.add(cellKey({ col, row }));
      }
    }
  }

  return {
    origin,
    cellSize,
    cols,
    rows,
    blocked,
    obstacles,
    signature,
    padding,
  };
}

function computeWorldBounds(gameState: RuntimeGameState) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const thing of gameState.things) {
    minX = Math.min(minX, thing.x);
    minY = Math.min(minY, thing.y);
    maxX = Math.max(maxX, thing.x + thing.width);
    maxY = Math.max(maxY, thing.y + thing.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }

  return { minX, minY, maxX, maxY };
}

function rectsOverlap(a: Rect, b: Rect) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function createGridSignature(
  gameState: RuntimeGameState,
  cellSize: number,
  padding: Vector
) {
  const bounds = computeWorldBounds(gameState);
  const boundsKey = `${bounds.minX}:${bounds.minY}:${bounds.maxX}:${bounds.maxY}`;
  const paddingKey = `${padding.x}:${padding.y}`;
  const parts = getStaticObstacles(gameState)
    .map(
      (obstacle) =>
        `${obstacle.minX}:${obstacle.minY}:${obstacle.maxX}:${obstacle.maxY}`
    )
    .sort()
    .join("|");
  return `${cellSize}:${paddingKey}:${boundsKey}:${parts}`;
}

function getStaticObstacles(gameState: RuntimeGameState): Rect[] {
  const blueprintLookup = new Map(
    gameState.blueprints.map((bp) => [bp.name, bp.physicsType])
  );
  return gameState.things
    .filter((thing) => {
      const physicsType =
        thing.physicsType ?? blueprintLookup.get(thing.blueprintName);
      return physicsType === "static";
    })
    .map((thing) => ({
      minX: thing.x,
      minY: thing.y,
      maxX: thing.x + thing.width,
      maxY: thing.y + thing.height,
    }));
}

function neighbors(cell: Cell, grid: NavGrid): Cell[] {
  const candidates: Cell[] = [
    { col: cell.col + 1, row: cell.row },
    { col: cell.col - 1, row: cell.row },
    { col: cell.col, row: cell.row + 1 },
    { col: cell.col, row: cell.row - 1 },
  ];
  return candidates.filter(
    (candidate) =>
      isWithinGrid(candidate, grid) && !grid.blocked.has(cellKey(candidate))
  );
}

function clampCellToBounds(cell: Cell, grid: NavGrid): Cell {
  return {
    col: Math.min(grid.cols - 1, Math.max(0, cell.col)),
    row: Math.min(grid.rows - 1, Math.max(0, cell.row)),
  };
}

function findNearestOpenCell(start: Cell, grid: NavGrid): Cell | null {
  const visited = new Set<string>();
  const queue: Cell[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = cellKey(current);
    if (visited.has(key)) continue;
    visited.add(key);

    if (!grid.blocked.has(key)) {
      return current;
    }

    queue.push(...neighbors(current, grid));
  }

  return null;
}

function heuristic(a: Cell, b: Cell) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function reconstructPath(
  goal: Cell,
  cameFrom: Map<string, Cell>,
  grid: NavGrid
) {
  const path: Cell[] = [goal];
  let currentKey = cellKey(goal);

  while (cameFrom.has(currentKey)) {
    const previous = cameFrom.get(currentKey)!;
    path.unshift(previous);
    currentKey = cellKey(previous);
  }

  return path.map((cell) => cellCenter(cell, grid));
}

function cellKey(cell: Cell) {
  return `${cell.col},${cell.row}`;
}

function cellsEqual(a: Cell, b: Cell) {
  return a.col === b.col && a.row === b.row;
}

function isWithinGrid(cell: Cell, grid: NavGrid) {
  return (
    cell.col >= 0 &&
    cell.row >= 0 &&
    cell.col < grid.cols &&
    cell.row < grid.rows
  );
}

function inflateRect(rect: Rect, padding: Vector): Rect {
  if (padding.x === 0 && padding.y === 0) {
    return rect;
  }
  return {
    minX: rect.minX - padding.x,
    minY: rect.minY - padding.y,
    maxX: rect.maxX + padding.x,
    maxY: rect.maxY + padding.y,
  };
}

function segmentsIntersectRect(start: Vector, end: Vector, rect: Rect) {
  if (pointInsideRect(start, rect) || pointInsideRect(end, rect)) {
    return true;
  }

  const corners = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];

  return (
    segmentsIntersect(start, end, corners[0], corners[1]) ||
    segmentsIntersect(start, end, corners[1], corners[2]) ||
    segmentsIntersect(start, end, corners[2], corners[3]) ||
    segmentsIntersect(start, end, corners[3], corners[0])
  );
}

function pointInsideRect(point: Vector, rect: Rect) {
  return (
    point.x >= rect.minX &&
    point.x <= rect.maxX &&
    point.y >= rect.minY &&
    point.y <= rect.maxY
  );
}

function segmentsIntersect(
  a1: Vector,
  a2: Vector,
  b1: Vector,
  b2: Vector
) {
  const d1 = direction(a1, a2, b1);
  const d2 = direction(a1, a2, b2);
  const d3 = direction(b1, b2, a1);
  const d4 = direction(b1, b2, a2);

  if (d1 === 0 && onSegment(a1, b1, a2)) return true;
  if (d2 === 0 && onSegment(a1, b2, a2)) return true;
  if (d3 === 0 && onSegment(b1, a1, b2)) return true;
  if (d4 === 0 && onSegment(b1, a2, b2)) return true;

  return d1 * d2 < 0 && d3 * d4 < 0;
}

function direction(from: Vector, to: Vector, point: Vector) {
  return (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
}

function onSegment(start: Vector, point: Vector, end: Vector) {
  return (
    Math.min(start.x, end.x) <= point.x &&
    point.x <= Math.max(start.x, end.x) &&
    Math.min(start.y, end.y) <= point.y &&
    point.y <= Math.max(start.y, end.y)
  );
}
