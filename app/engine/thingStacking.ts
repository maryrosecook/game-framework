import { Blueprint, RuntimeThing } from "./types";

type LayeredThing = {
  thing: RuntimeThing;
  z: number;
  sequence: number;
};

export type ThingStack = readonly RuntimeThing[];

const compareLayeredThings = (a: LayeredThing, b: LayeredThing) => {
  if (a.z !== b.z) {
    return a.z - b.z;
  }
  return a.sequence - b.sequence;
};

export function createThingStack(
  things: RuntimeThing[],
  blueprintLookup: Map<string, Blueprint>
): ThingStack {
  const layeredThings: LayeredThing[] = things.map((thing, index) => ({
    thing,
    z: blueprintLookup.get(thing.blueprintName)?.z ?? 1,
    sequence: index,
  }));

  // Stable layering: blueprint z first, then existing list order for ties.
  const orderedLayers = [...layeredThings].sort(compareLayeredThings);
  return orderedLayers.map((entry) => entry.thing);
}

export function findTopmostInStack(
  stack: ThingStack,
  predicate: (thing: RuntimeThing) => boolean
): RuntimeThing | null {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const candidate = stack[i];
    if (predicate(candidate)) {
      return candidate;
    }
  }
  return null;
}
