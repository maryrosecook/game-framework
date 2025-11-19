import { createThingId } from "@/lib/id";
import { normalizeName } from "./reducer";
import { Blueprint, RuntimeThing, RawThing } from "./types";

export function getBlueprintForThing(
  thing: RawThing,
  blueprintLookup: Map<string, Blueprint>
): Blueprint | undefined {
  return blueprintLookup.get(normalizeName(thing.blueprintName));
}

export function createThingFromBlueprint(
  blueprint: Blueprint,
  point: { x: number; y: number },
  thing: Partial<RawThing> = {}
): RuntimeThing {
  const width = thing.width ?? blueprint.width;
  const height = thing.height ?? blueprint.height;
  const x = thing.x ?? point.x - width / 2;
  const y = thing.y ?? point.y - height / 2;

  return {
    id: thing.id ?? createThingId(),
    x,
    y,
    angle: thing.angle ?? 0,
    velocityX: thing.velocityX ?? 0,
    velocityY: thing.velocityY ?? 0,
    physicsType: thing.physicsType ?? blueprint.physicsType,
    blueprintName: thing.blueprintName ?? blueprint.name,
    width,
    height,
    z: thing.z ?? blueprint.z,
    color: thing.color ?? blueprint.color,
    shape: thing.shape ?? blueprint.shape,
  };
}
