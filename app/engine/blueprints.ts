import { normalizeName } from "./reducer";
import { Blueprint, Thing } from "./types";

export function getBlueprintForThing(
  thing: Thing,
  blueprintLookup: Map<string, Blueprint>
): Blueprint | undefined {
  return blueprintLookup.get(normalizeName(thing.blueprintName));
}
