import { Vector3 } from "./math";

export type PlayerData = {
  position: Vector3;
  forward: Vector3;
  yaw: number;
  pitch: number;
  basisRight: Vector3;
  basisUp: Vector3;
  lastTickMs: number;
  lastShotMs: number | null;
  hasSpawnedTargets: boolean;
  fireHeld: boolean;
};

export type TargetData = {
  position: Vector3;
};
