import { BlueprintData, GameContext, KeyState, RuntimeThing } from "@/engine/types";
import { HORIZONTAL_FOV_DEGREES, NEAR_CLIP, TARGET_WORLD_SIZE } from "./constants";
import { getPlayerBasis } from "./player";
import { Vector3, dot3, subtract3 } from "./math";
import { PlayerData, TargetData } from "./types";

export default function createTargetBlueprint(data: BlueprintData<TargetData>) {
  return {
    ...data,
    update: function updateTargetDepth(
      thing: RuntimeThing<TargetData>,
      game: GameContext,
      _keyState: KeyState
    ) {
      const targetData = ensureTargetData(thing);
      const player = game.gameState.things.find(
        (candidate): candidate is RuntimeThing<PlayerData> =>
          candidate.blueprintName === "player"
      );
      if (!player?.data) {
        return;
      }

      const basis = getPlayerBasis(player.data);
      const toTarget = subtract3(targetData.position, player.data.position);
      const cameraSpace = toCameraSpace(toTarget, basis);
      if (cameraSpace.z <= NEAR_CLIP) {
        return;
      }
      thing.z = -cameraSpace.z;
    },
    render: function renderTarget(
      thing: RuntimeThing<TargetData>,
      game: GameContext,
      ctx: CanvasRenderingContext2D
    ) {
      const targetData = ensureTargetData(thing);
      const player = game.gameState.things.find(
        (candidate): candidate is RuntimeThing<PlayerData> =>
          candidate.blueprintName === "player"
      );
      if (!player?.data) {
        return;
      }

      const basis = getPlayerBasis(player.data);
      const toTarget = subtract3(targetData.position, player.data.position);
      const cameraSpace = toCameraSpace(toTarget, basis);
      if (cameraSpace.z <= NEAR_CLIP) {
        return;
      }

      const cameraVertices = buildCameraCubeVertices(
        targetData.position,
        player.data.position,
        basis
      );
      if (cameraVertices.some((vertex) => vertex.z <= NEAR_CLIP)) {
        return;
      }

      const screen = game.gameState.screen;
      const canvas = ctx.canvas;
      const focalLength =
        (0.5 * screen.width) /
        Math.tan((HORIZONTAL_FOV_DEGREES * Math.PI) / 360);
      const projectedVertices = projectVertices(
        cameraVertices,
        screen,
        canvas,
        focalLength
      );

      const visibleFaces = getVisibleFaces(cameraVertices, basis);
      if (visibleFaces.length === 0) {
        return;
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ffffff";
      ctx.fillStyle = "#000000";
      ctx.lineJoin = "round";

      const sortedFaces = [...visibleFaces].sort(
        (a, b) => b.depth - a.depth
      );
      for (const face of sortedFaces) {
        const indices = face.indices;
        if (indices.length === 0) {
          continue;
        }
        ctx.beginPath();
        const first = projectedVertices[indices[0]];
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < indices.length; i += 1) {
          const point = projectedVertices[indices[i]];
          ctx.lineTo(point.x, point.y);
        }
        ctx.closePath();
        ctx.fill();
      }

      const visibleEdges = collectVisibleEdges(visibleFaces);
      ctx.beginPath();
      visibleEdges.forEach((edge) => {
        const start = projectedVertices[edge.start];
        const end = projectedVertices[edge.end];
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
      });
      ctx.stroke();
      ctx.restore();
    },
  };
}

function ensureTargetData(target: RuntimeThing<TargetData>): TargetData {
  const fallback = target.data ?? {
    position: { x: target.x, y: target.y, z: 0 },
  };
  target.data = fallback;
  return fallback;
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

type CubeFace = { indices: number[]; normal: Vector3 };
type ProjectedVertex = { x: number; y: number; z: number };
type EdgeIndex = { start: number; end: number };
type VisibleFace = { indices: number[]; depth: number };

const CUBE_VERTEX_OFFSETS: Vector3[] = [
  { x: -1, y: -1, z: -1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 },
  { x: -1, y: 1, z: 1 },
];

const CUBE_FACES: CubeFace[] = [
  { indices: [0, 1, 2, 3], normal: { x: 0, y: 0, z: -1 } },
  { indices: [4, 5, 6, 7], normal: { x: 0, y: 0, z: 1 } },
  { indices: [0, 4, 5, 1], normal: { x: 0, y: -1, z: 0 } },
  { indices: [3, 2, 6, 7], normal: { x: 0, y: 1, z: 0 } },
  { indices: [0, 3, 7, 4], normal: { x: -1, y: 0, z: 0 } },
  { indices: [1, 5, 6, 2], normal: { x: 1, y: 0, z: 0 } },
];

function buildCameraCubeVertices(
  targetPosition: Vector3,
  playerPosition: Vector3,
  basis: { forward: Vector3; right: Vector3; up: Vector3 }
): Vector3[] {
  const halfSize = TARGET_WORLD_SIZE / 2;
  const vertices: Vector3[] = [];
  for (const offset of CUBE_VERTEX_OFFSETS) {
    const worldVertex = {
      x: targetPosition.x + offset.x * halfSize,
      y: targetPosition.y + offset.y * halfSize,
      z: targetPosition.z + offset.z * halfSize,
    };
    const toVertex = subtract3(worldVertex, playerPosition);
    vertices.push(toCameraSpace(toVertex, basis));
  }
  return vertices;
}

function projectVertices(
  vertices: Vector3[],
  screen: GameContext["gameState"]["screen"],
  canvas: HTMLCanvasElement,
  focalLength: number
): ProjectedVertex[] {
  const offsetX = (canvas.width - screen.width) / 2;
  const offsetY = (canvas.height - screen.height) / 2;
  const centerX = offsetX + screen.width / 2;
  const centerY = offsetY + screen.height / 2;
  const projected: ProjectedVertex[] = [];
  for (const vertex of vertices) {
    const projectedX = (vertex.x / vertex.z) * focalLength;
    const projectedY = (vertex.y / vertex.z) * focalLength;
    projected.push({
      x: centerX + projectedX,
      y: centerY - projectedY,
      z: vertex.z,
    });
  }
  return projected;
}

function getVisibleFaces(
  cameraVertices: Vector3[],
  basis: { forward: Vector3; right: Vector3; up: Vector3 }
): VisibleFace[] {
  const visibleFaces: VisibleFace[] = [];
  for (const face of CUBE_FACES) {
    const faceCenter = averageVertices(cameraVertices, face.indices);
    const normalCamera = toCameraSpace(face.normal, basis);
    if (dot3(normalCamera, faceCenter) < 0) {
      const depth = averageDepth(cameraVertices, face.indices);
      visibleFaces.push({ indices: face.indices, depth });
    }
  }
  return visibleFaces;
}

function averageVertices(vertices: Vector3[], indices: number[]): Vector3 {
  let totalX = 0;
  let totalY = 0;
  let totalZ = 0;
  for (const index of indices) {
    const vertex = vertices[index];
    totalX += vertex.x;
    totalY += vertex.y;
    totalZ += vertex.z;
  }
  const count = indices.length;
  if (count === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: totalX / count,
    y: totalY / count,
    z: totalZ / count,
  };
}

function averageDepth(vertices: Vector3[], indices: number[]): number {
  let total = 0;
  for (const index of indices) {
    total += vertices[index].z;
  }
  return indices.length === 0 ? 0 : total / indices.length;
}

function collectVisibleEdges(faces: VisibleFace[]): Map<string, EdgeIndex> {
  const edges = new Map<string, EdgeIndex>();
  for (const face of faces) {
    const indices = face.indices;
    if (indices.length === 0) {
      continue;
    }
    for (let i = 0; i < indices.length; i += 1) {
      const start = indices[i];
      const end = indices[(i + 1) % indices.length];
      addEdge(edges, start, end);
    }
  }
  return edges;
}

function addEdge(
  edges: Map<string, EdgeIndex>,
  start: number,
  end: number
): void {
  const key = start < end ? `${start}-${end}` : `${end}-${start}`;
  if (!edges.has(key)) {
    edges.set(key, { start, end });
  }
}
