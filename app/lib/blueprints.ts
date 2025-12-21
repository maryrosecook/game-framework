import { Blueprint, PhysicsType, Shape } from "@/engine/types";

const SLUG_PATTERN = /[^a-z0-9]+/g;

export function blueprintSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(SLUG_PATTERN, "-")
    .replace(/(^-|-$)/g, "");
}

export function blueprintTemplate() {
  return ``;
}

const DEFAULTS: Pick<
  Blueprint,
  "width" | "height" | "z" | "shape" | "physicsType" | "image"
> = {
  width: 100,
  height: 100,
  z: 1,
  shape: "rectangle",
  physicsType: "dynamic",
  image: undefined,
};

export function createBlueprint(
  values: Partial<Blueprint> & Pick<Blueprint, "name">
): Blueprint {
  const shape: Shape = values.shape ?? DEFAULTS.shape;
  const physicsType: PhysicsType = values.physicsType ?? DEFAULTS.physicsType;
  return {
    ...DEFAULTS,
    color: values.color ?? "#888888",
    image: values.image ?? DEFAULTS.image,
    ...values,
    shape,
    physicsType,
  };
}

export function getNextBlueprintName(
  blueprints: { name: string }[],
  preferredBase?: string
) {
  const existing = new Set(blueprints.map((bp) => bp.name));
  if (preferredBase) {
    const base = blueprintSlug(preferredBase) || "blueprint";
    let candidate = base;
    let counter = 2;
    while (existing.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }
    return candidate;
  }

  let counter = blueprints.length + 1;
  let candidate = `blueprint-${counter}`;
  while (existing.has(candidate)) {
    counter += 1;
    candidate = `blueprint-${counter}`;
  }
  return candidate;
}
