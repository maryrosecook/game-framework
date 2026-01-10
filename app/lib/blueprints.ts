import { Blueprint, PhysicsType, Shape } from "@/engine/types";

export const DEFAULT_BLUEPRINT_WEIGHT = 1;
export const DEFAULT_BLUEPRINT_BOUNCE = 0;

const SLUG_PATTERN = /[^a-z0-9]+/g;

export function blueprintSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(SLUG_PATTERN, "-")
    .replace(/(^-|-$)/g, "");
}

export function blueprintTemplate() {
  return `export {}`;
}

const DEFAULTS: Pick<
  Blueprint,
  "width" | "height" | "shape" | "physicsType" | "images" | "weight" | "bounce"
> = {
  width: 100,
  height: 100,
  shape: "rectangle",
  physicsType: "dynamic",
  images: undefined,
  weight: DEFAULT_BLUEPRINT_WEIGHT,
  bounce: DEFAULT_BLUEPRINT_BOUNCE,
};

export function createBlueprint(
  values: Partial<Blueprint> & Pick<Blueprint, "name">
): Blueprint {
  const shape: Shape = values.shape ?? DEFAULTS.shape;
  const physicsType: PhysicsType = values.physicsType ?? DEFAULTS.physicsType;
  const weight = values.weight ?? DEFAULTS.weight;
  const bounce = values.bounce ?? DEFAULTS.bounce;
  return {
    ...DEFAULTS,
    color: values.color ?? "#888888",
    images: values.images ?? DEFAULTS.images,
    ...values,
    shape,
    physicsType,
    weight,
    bounce,
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
