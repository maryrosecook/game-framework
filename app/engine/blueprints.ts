import { createThingId } from "@/lib/id";
import { Blueprint, RawThing } from "./types";

export function getBlueprintForThing(
  thing: RawThing,
  blueprintLookup: Map<string, Blueprint>
): Blueprint | undefined {
  return blueprintLookup.get(thing.blueprintName);
}

export function createThingFromBlueprint(
  blueprint: Blueprint,
  point: { x: number; y: number },
  thing: Partial<RawThing> = {}
): RawThing {
  const width = thing.width ?? blueprint.width;
  const height = thing.height ?? blueprint.height;
  const x = thing.x ?? point.x - width / 2;
  const y = thing.y ?? point.y - height / 2;
  const data = thing.data ?? blueprint.data;

  return {
    id: thing.id ?? createThingId(),
    x,
    y,
    z: thing.z ?? blueprint.z,
    angle: thing.angle ?? 0,
    velocityX: thing.velocityX ?? 0,
    velocityY: thing.velocityY ?? 0,
    blueprintName: thing.blueprintName ?? blueprint.name,
    width,
    height,
    shape: thing.shape ?? blueprint.shape,
    data,
  };
}
