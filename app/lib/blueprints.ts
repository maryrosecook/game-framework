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
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
`;
}

const DEFAULTS: Pick<
  Blueprint,
  "width" | "height" | "z" | "shape" | "physicsType" | "image"
> = {
  width: 50,
  height: 50,
  z: 1,
  shape: "rectangle",
  physicsType: "dynamic",
  image: undefined,
};

export function createBlueprint(
  values: Partial<Blueprint> &
    Pick<Blueprint, "name"> & { color?: string; image?: string }
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
