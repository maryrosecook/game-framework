import { ParticleSpawnRequest, Vector } from "./types";

export type ParticleSystem = {
  spawn: (request: ParticleSpawnRequest) => void;
  step: (
    camera: Vector,
    screen: { width: number; height: number },
    isPaused: boolean
  ) => void;
  render: (ctx: CanvasRenderingContext2D, camera: Vector) => void;
  reset: () => void;
  getCount: () => number;
};

const DEFAULT_PARTICLE_CAPACITY = 1024;
const PARTICLE_SIZE = 6;

export function createParticleSystem(
  initialCapacity: number = DEFAULT_PARTICLE_CAPACITY
): ParticleSystem {
  let capacity = normalizeCapacity(initialCapacity);
  let count = 0;
  let positionsX = new Float32Array(capacity);
  let positionsY = new Float32Array(capacity);
  let velocitiesX = new Float32Array(capacity);
  let velocitiesY = new Float32Array(capacity);
  let colors = createColorBuffer(capacity);

  function spawn(request: ParticleSpawnRequest): void {
    ensureCapacity(count + 1);
    const index = count;
    count += 1;
    positionsX[index] = request.position.x;
    positionsY[index] = request.position.y;
    velocitiesX[index] = request.velocity.x;
    velocitiesY[index] = request.velocity.y;
    colors[index] = request.color;
  }

  function step(
    camera: Vector,
    screen: { width: number; height: number },
    isPaused: boolean
  ): void {
    if (count === 0) {
      return;
    }

    const minX = camera.x;
    const minY = camera.y;
    const maxX = camera.x + screen.width;
    const maxY = camera.y + screen.height;

    let index = 0;
    while (index < count) {
      if (!isPaused) {
        positionsX[index] += velocitiesX[index];
        positionsY[index] += velocitiesY[index];
      }

      const x = positionsX[index];
      const y = positionsY[index];
      const isOutside =
        x + PARTICLE_SIZE < minX ||
        x >= maxX ||
        y + PARTICLE_SIZE < minY ||
        y >= maxY;
      if (isOutside) {
        removeAt(index);
        continue;
      }

      index += 1;
    }
  }

  function render(ctx: CanvasRenderingContext2D, camera: Vector): void {
    if (count === 0) {
      return;
    }

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    ctx.imageSmoothingEnabled = false;

    let currentColor = "";
    for (let index = 0; index < count; index += 1) {
      const color = colors[index];
      if (color !== currentColor) {
        ctx.fillStyle = color;
        currentColor = color;
      }
      ctx.fillRect(
        positionsX[index],
        positionsY[index],
        PARTICLE_SIZE,
        PARTICLE_SIZE
      );
    }

    ctx.restore();
  }

  function reset(): void {
    count = 0;
  }

  function getCount(): number {
    return count;
  }

  function ensureCapacity(required: number): void {
    if (required <= capacity) {
      return;
    }

    let nextCapacity = capacity;
    while (nextCapacity < required) {
      nextCapacity *= 2;
    }

    const nextPositionsX = new Float32Array(nextCapacity);
    nextPositionsX.set(positionsX);
    positionsX = nextPositionsX;

    const nextPositionsY = new Float32Array(nextCapacity);
    nextPositionsY.set(positionsY);
    positionsY = nextPositionsY;

    const nextVelocitiesX = new Float32Array(nextCapacity);
    nextVelocitiesX.set(velocitiesX);
    velocitiesX = nextVelocitiesX;

    const nextVelocitiesY = new Float32Array(nextCapacity);
    nextVelocitiesY.set(velocitiesY);
    velocitiesY = nextVelocitiesY;

    const nextColors = createColorBuffer(nextCapacity);
    for (let index = 0; index < count; index += 1) {
      nextColors[index] = colors[index];
    }
    colors = nextColors;

    capacity = nextCapacity;
  }

  function removeAt(index: number): void {
    const lastIndex = count - 1;
    if (index !== lastIndex) {
      positionsX[index] = positionsX[lastIndex];
      positionsY[index] = positionsY[lastIndex];
      velocitiesX[index] = velocitiesX[lastIndex];
      velocitiesY[index] = velocitiesY[lastIndex];
      colors[index] = colors[lastIndex];
    }
    count = lastIndex;
  }

  return {
    spawn,
    step,
    render,
    reset,
    getCount,
  };
}

function normalizeCapacity(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PARTICLE_CAPACITY;
  }
  return Math.max(1, Math.floor(value));
}

function createColorBuffer(size: number): string[] {
  return new Array<string>(size);
}
