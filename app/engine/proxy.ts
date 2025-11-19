import { getBlueprintForThing } from "./blueprints";
import { Blueprint, RawThing, RuntimeThing } from "./types";

export function createThingProxy(
  thing: RawThing,
  blueprintLookup: Map<string, Blueprint>
): RuntimeThing {
  return new Proxy(thing, {
    get(target, prop) {
      const ownValue = (target as Record<PropertyKey, unknown>)[prop];
      if (ownValue !== undefined) {
        return ownValue;
      }
      if (typeof prop === "string") {
        const blueprint = getBlueprintForThing(target, blueprintLookup);
        const blueprintValue =
          blueprint && (blueprint as Record<string, unknown>)[prop];
        if (blueprintValue !== undefined) {
          return blueprintValue;
        }
      }
      return ownValue;
    },
    set(target, prop, value) {
      (target as Record<string, unknown>)[prop as string] = value;
      return true;
    },
  }) as RuntimeThing;
}
