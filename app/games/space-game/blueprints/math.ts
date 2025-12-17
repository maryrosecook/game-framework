export type Vector3 = { x: number; y: number; z: number };
export type CameraBasis = { forward: Vector3; right: Vector3; up: Vector3 };

export function length3(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalize3(vector: Vector3): Vector3 {
  const magnitude = length3(vector);
  if (magnitude === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

export function add3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract3(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(vector: Vector3, scale: number): Vector3 {
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

export function dot3(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function yawPitchToForward(yawDegrees: number, pitchDegrees: number): Vector3 {
  const yaw = degreesToRadians(yawDegrees);
  const pitch = degreesToRadians(pitchDegrees);
  const cosPitch = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * cosPitch,
    y: Math.sin(pitch),
    z: Math.cos(yaw) * cosPitch,
  };
}

export function rotateAroundAxis(
  vector: Vector3,
  axis: Vector3,
  angleRadians: number
): Vector3 {
  if (angleRadians === 0) {
    return vector;
  }
  const axisLength = length3(axis);
  if (axisLength === 0) {
    return vector;
  }
  const normalizedAxis = {
    x: axis.x / axisLength,
    y: axis.y / axisLength,
    z: axis.z / axisLength,
  };
  const cosTheta = Math.cos(angleRadians);
  const sinTheta = Math.sin(angleRadians);
  const dot = dot3(normalizedAxis, vector);
  const cross = cross3(normalizedAxis, vector);
  return {
    x:
      vector.x * cosTheta +
      cross.x * sinTheta +
      normalizedAxis.x * dot * (1 - cosTheta),
    y:
      vector.y * cosTheta +
      cross.y * sinTheta +
      normalizedAxis.y * dot * (1 - cosTheta),
    z:
      vector.z * cosTheta +
      cross.z * sinTheta +
      normalizedAxis.z * dot * (1 - cosTheta),
  };
}

export function createCameraBasis(forward: Vector3, prior?: CameraBasis): CameraBasis {
  const normalizedForward = normalize3(forward);
  const worldUp: Vector3 = { x: 0, y: 1, z: 0 };
  const fallbackUp: Vector3 = prior?.up ?? { x: 0, y: 0, z: 1 };
  const useFallback =
    Math.abs(dot3(normalizedForward, worldUp)) > 0.98 && prior?.up !== undefined;
  const referenceUp = useFallback ? fallbackUp : worldUp;

  let right = cross3(referenceUp, normalizedForward);
  if (length3(right) === 0) {
    right = cross3(fallbackUp, normalizedForward);
  }
  right = normalize3(right);
  let up = normalize3(cross3(normalizedForward, right));

  if (prior && dot3(up, prior.up) < 0) {
    up = scale3(up, -1);
    right = scale3(right, -1);
  }

  return { forward: normalizedForward, right, up };
}
