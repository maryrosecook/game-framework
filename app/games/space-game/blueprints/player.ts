import {
  BlueprintData,
  GameContext,
  KeyState,
  RuntimeThing,
} from "@/engine/types";
import {
  FOV_DEGREES,
  LASER_FLASH_DURATION_MS,
  NEAR_CLIP,
  PLAYER_SPEED_UNITS_PER_SECOND,
  ROTATION_SPEED_DEG_PER_SECOND,
  TARGET_COUNT,
  TARGET_SPAWN_RANGE,
  TARGET_WORLD_SIZE,
} from "./constants";
import {
  CameraBasis,
  Vector3,
  add3,
  cross3,
  createCameraBasis,
  dot3,
  degreesToRadians,
  length3,
  normalize3,
  radiansToDegrees,
  rotateAroundAxis,
  scale3,
  subtract3,
} from "./math";
import { PlayerData, TargetData } from "./types";

const TARGET_BLUEPRINT = "target";
const DEFAULT_PLAYER_DATA: PlayerData = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 0, y: 0, z: 1 },
  basisRight: { x: 1, y: 0, z: 0 },
  basisUp: { x: 0, y: 1, z: 0 },
  yaw: 0,
  pitch: 0,
  lastTickMs: Date.now(),
  lastShotMs: null,
  hasSpawnedTargets: false,
  fireHeld: false,
};

export default function createPlayerBlueprint(data: BlueprintData<PlayerData>) {
  return {
    ...data,
    input: (
      thing: RuntimeThing<PlayerData>,
      game: GameContext,
      keys: KeyState
    ) => {
      const playerData = ensurePlayerData(thing);
      spawnTargetsIfNeeded(game, playerData);

      const now = Date.now();
      const deltaSeconds = Math.max((now - playerData.lastTickMs) / 1000, 0);
      playerData.lastTickMs = now;

      updateOrientation(playerData, keys, deltaSeconds);

      const movement = scale3(
        playerData.forward,
        PLAYER_SPEED_UNITS_PER_SECOND * deltaSeconds
      );
      playerData.position = add3(playerData.position, movement);

      thing.x = playerData.position.x;
      thing.y = playerData.position.y;
      thing.velocityX = 0;
      thing.velocityY = 0;
      thing.angle = playerData.yaw;

      const fired = keys.digit1 && !playerData.fireHeld;
      if (fired) {
        attemptHitscan(game, playerData);
        playerData.lastShotMs = now;
      }
      playerData.fireHeld = keys.digit1;
    },
  };
}

function ensurePlayerData(thing: RuntimeThing<PlayerData>): PlayerData {
  if (!thing.data) {
    thing.data = { ...DEFAULT_PLAYER_DATA };
    return thing.data;
  }
  const position = thing.data.position ?? DEFAULT_PLAYER_DATA.position;
  const forward = normalize3(thing.data.forward ?? DEFAULT_PLAYER_DATA.forward);
  const lastTickMs = thing.data.lastTickMs ?? Date.now();
  const lastShotMs = thing.data.lastShotMs ?? null;
  const hasSpawnedTargets =
    thing.data.hasSpawnedTargets ?? DEFAULT_PLAYER_DATA.hasSpawnedTargets;
  const fireHeld = thing.data.fireHeld ?? DEFAULT_PLAYER_DATA.fireHeld;
  const priorBasis: CameraBasis | null =
    thing.data.basisRight && thing.data.basisUp
      ? {
          forward,
          right: thing.data.basisRight,
          up: thing.data.basisUp,
        }
      : null;
  const basis = priorBasis
    ? orthonormalizeBasis({
        forward,
        right: priorBasis.right,
        up: priorBasis.up,
      })
    : createCameraBasis(forward);
  const orientation = forwardToYawPitch(basis.forward);
  const normalized: PlayerData = {
    position,
    forward: basis.forward,
    basisRight: basis.right,
    basisUp: basis.up,
    yaw: orientation.yaw,
    pitch: orientation.pitch,
    lastTickMs,
    lastShotMs,
    hasSpawnedTargets,
    fireHeld,
  };
  thing.data = normalized;
  return normalized;
}

function updateOrientation(
  player: PlayerData,
  keys: KeyState,
  deltaSeconds: number
) {
  const horizontalInput = Number(keys.arrowRight) - Number(keys.arrowLeft);
  const verticalInput = Number(keys.arrowUp) - Number(keys.arrowDown);
  if (horizontalInput === 0 && verticalInput === 0) {
    return;
  }

  const yawDeltaRadians = degreesToRadians(
    horizontalInput * ROTATION_SPEED_DEG_PER_SECOND * deltaSeconds
  );
  const pitchDeltaRadians = degreesToRadians(
    verticalInput * ROTATION_SPEED_DEG_PER_SECOND * deltaSeconds
  );

  const rotatedBasis = rotatePlayerBasis(
    {
      forward: player.forward,
      right: player.basisRight,
      up: player.basisUp,
    },
    yawDeltaRadians,
    pitchDeltaRadians
  );

  player.forward = rotatedBasis.forward;
  player.basisRight = rotatedBasis.right;
  player.basisUp = rotatedBasis.up;

  const orientation = forwardToYawPitch(player.forward);
  player.yaw = orientation.yaw;
  player.pitch = orientation.pitch;
}

function orthonormalizeBasis(basis: {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
}) {
  const normalizedForward = normalize3(basis.forward);

  let normalizedRight = normalize3(basis.right);
  if (length3(normalizedRight) === 0) {
    normalizedRight = DEFAULT_PLAYER_DATA.basisRight;
  }

  let normalizedUp = normalize3(basis.up);
  if (length3(normalizedUp) === 0) {
    normalizedUp = DEFAULT_PLAYER_DATA.basisUp;
  }

  const computedUp = cross3(normalizedForward, normalizedRight);
  const safeUp =
    length3(computedUp) === 0 ? normalizedUp : normalize3(computedUp);

  const recomputedRight = cross3(safeUp, normalizedForward);
  const safeRight =
    length3(recomputedRight) === 0
      ? normalize3(normalizedRight)
      : normalize3(recomputedRight);

  const finalUp = cross3(normalizedForward, safeRight);

  return {
    forward: normalizedForward,
    right: safeRight,
    up: length3(finalUp) === 0 ? safeUp : normalize3(finalUp),
  };
}

function rotatePlayerBasis(
  basis: { forward: Vector3; right: Vector3; up: Vector3 },
  yawDeltaRadians: number,
  pitchDeltaRadians: number
) {
  const yawAppliedForward =
    yawDeltaRadians !== 0
      ? rotateAroundAxis(basis.forward, basis.up, yawDeltaRadians)
      : basis.forward;
  const yawAppliedRight =
    yawDeltaRadians !== 0
      ? rotateAroundAxis(basis.right, basis.up, yawDeltaRadians)
      : basis.right;
  const yawAppliedUp = basis.up;

  const pitchAppliedForward =
    pitchDeltaRadians !== 0
      ? rotateAroundAxis(yawAppliedForward, yawAppliedRight, pitchDeltaRadians)
      : yawAppliedForward;
  const pitchAppliedUp =
    pitchDeltaRadians !== 0
      ? rotateAroundAxis(yawAppliedUp, yawAppliedRight, pitchDeltaRadians)
      : yawAppliedUp;

  return orthonormalizeBasis({
    forward: pitchAppliedForward,
    right: yawAppliedRight,
    up: pitchAppliedUp,
  });
}

function forwardToYawPitch(forward: Vector3) {
  const normalizedForward = normalize3(forward);
  const yawRadians = Math.atan2(normalizedForward.x, normalizedForward.z);
  const clampedY = Math.max(-1, Math.min(1, normalizedForward.y));
  const pitchRadians = Math.asin(clampedY);
  return {
    yaw: radiansToDegrees(yawRadians),
    pitch: radiansToDegrees(pitchRadians),
  };
}

function spawnTargetsIfNeeded(game: GameContext, playerData: PlayerData) {
  if (playerData.hasSpawnedTargets) {
    return;
  }
  for (let i = 0; i < TARGET_COUNT; i += 1) {
    const position = {
      x: randomInRange(-TARGET_SPAWN_RANGE, TARGET_SPAWN_RANGE),
      y: randomInRange(-TARGET_SPAWN_RANGE, TARGET_SPAWN_RANGE),
      z: randomInRange(-TARGET_SPAWN_RANGE, TARGET_SPAWN_RANGE),
    };
    game.spawn({
      blueprint: TARGET_BLUEPRINT,
      position: { x: position.x, y: position.y },
      overrides: {
        data: { position },
        width: TARGET_WORLD_SIZE,
        height: TARGET_WORLD_SIZE,
      },
    });
  }
  playerData.hasSpawnedTargets = true;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function attemptHitscan(game: GameContext, playerData: PlayerData) {
  const hit = findHitTarget(game, playerData);
  if (hit) {
    game.destroy(hit);
  }
}

function findHitTarget(
  game: GameContext,
  playerData: PlayerData
): RuntimeThing<TargetData> | null {
  const targets = game.gameState.things.filter(
    (candidate): candidate is RuntimeThing<TargetData> =>
      candidate.blueprintName === TARGET_BLUEPRINT
  );
  if (targets.length === 0) {
    return null;
  }

  const basis = getPlayerBasis(playerData);
  const screen = game.gameState.screen;
  const focalLength =
    (0.5 * screen.height) / Math.tan((FOV_DEGREES * Math.PI) / 360);
  const screenCenter = {
    x: screen.width / 2,
    y: screen.height / 2,
  };

  let best: { target: RuntimeThing<TargetData>; depth: number } | null = null;
  for (const target of targets) {
    const targetData = target.data;
    if (!targetData) continue;
    const toTarget = subtract3(targetData.position, playerData.position);
    const distanceToTarget = length3(toTarget);
    const cameraSpace = toCameraSpace(toTarget, basis);
    if (cameraSpace.z <= NEAR_CLIP || distanceToTarget === 0) {
      continue;
    }

    const sizeScale = focalLength / distanceToTarget;
    const projectedSize = TARGET_WORLD_SIZE * sizeScale;
    const positionScale = focalLength / cameraSpace.z;
    const projectedX = screenCenter.x + cameraSpace.x * positionScale;
    const projectedY = screenCenter.y - cameraSpace.y * positionScale;

    const withinHorizontal =
      Math.abs(projectedX - screenCenter.x) <= projectedSize / 2;
    const withinVertical =
      Math.abs(projectedY - screenCenter.y) <= projectedSize / 2;

    if (withinHorizontal && withinVertical) {
      if (!best || cameraSpace.z < best.depth) {
        best = { target, depth: cameraSpace.z };
      }
    }
  }
  return best?.target ?? null;
}

function toCameraSpace(
  worldVector: Vector3,
  basis: { forward: Vector3; right: Vector3; up: Vector3 }
) {
  return {
    x: dot3(worldVector, basis.right),
    y: dot3(worldVector, basis.up),
    z: dot3(worldVector, basis.forward),
  };
}

export function isLaserActive(playerData: PlayerData, now: number) {
  return (
    playerData.lastShotMs !== null &&
    now - playerData.lastShotMs <= LASER_FLASH_DURATION_MS
  );
}

export function getPlayerBasis(player: PlayerData) {
  return {
    forward: player.forward,
    right: player.basisRight,
    up: player.basisUp,
  };
}

export function getPlayerPosition(player: PlayerData) {
  return player.position;
}

export function getPlayerForward(player: PlayerData) {
  return player.forward;
}
