import { Blueprint, PhysicsType, Shape } from "@/engine/types";

const SLUG_PATTERN = /[^a-z0-9]+/g;

export function blueprintSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(SLUG_PATTERN, "-")
    .replace(/(^-|-$)/g, "");
}

export function blueprintTemplate(blueprintName: string) {
  const safeName = blueprintName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s/g, "");
  return `import { BlueprintData, RuntimeGameState, RuntimeThing, KeyState } from "@/engine/types";

export default function create${safeName || "Blueprint"}(data: BlueprintData) {
  return {
    ...data,
    input: (thing: RuntimeThing, _state: RuntimeGameState, _keys: KeyState) => {
      return thing;
    },
    update: (thing: RuntimeThing, _state: RuntimeGameState, _things: RuntimeThing[]) => {
      return thing;
    },
    render: (thing: RuntimeThing, _state: RuntimeGameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      if (thing.width === thing.height && thing.width > 0 && data.shape === "circle") {
        const radius = thing.width / 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else if (data.shape === "triangle") {
        ctx.beginPath();
        ctx.moveTo(0, thing.height);
        ctx.lineTo(thing.width / 2, 0);
        ctx.lineTo(thing.width, thing.height);
        ctx.closePath();
        ctx.fill();
      } else if (data.shape === "circle") {
        const radius = Math.min(thing.width, thing.height) / 2;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, thing.width, thing.height);
      }
    },
  };
}
`;
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
