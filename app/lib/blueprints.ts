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
  return `import { BlueprintData, GameState, Thing, KeyState } from "@/engine/types";

export default function create${safeName || "Blueprint"}(data: BlueprintData) {
  return {
    ...data,
    input: (thing: Thing, _state: GameState, _keys: KeyState) => {
      return thing;
    },
    update: (thing: Thing, _state: GameState) => {
      return thing;
    },
    render: (thing: Thing, _state: GameState, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = thing.color;
      ctx.fillRect(0, 0, thing.width, thing.height);
    },
  };
}
`;
}
