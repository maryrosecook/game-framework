import { createThingId } from "@/lib/id";
import { z, type ZodType, type ZodTypeAny } from "zod";
import {
  Blueprint,
  BlueprintData,
  BlueprintDefinition,
  BlueprintKind,
  BlueprintModule,
  RawThing,
  RuntimeThing,
  Vector,
} from "./types";

type DataContext = { blueprintName: string; source: "blueprint" | "thing" };

const hasBlueprintName = (
  value: RuntimeThing | RawThing | null | undefined
): value is RuntimeThing | RawThing =>
  !!value && typeof value === "object" && "blueprintName" in value;

function dataSchemaFor<TData>(
  blueprint: Blueprint<TData>
): ZodType<TData> | undefined {
  return blueprint.dataSchema;
}

function validateThingData<TData>(
  schema: ZodType<TData> | undefined,
  candidate: TData | undefined,
  fallback: TData | undefined,
  context: DataContext,
  allowUndefined = false
): TData | undefined {
  if (!schema) {
    return candidate ?? fallback;
  }

  const chosen = candidate === undefined ? fallback : candidate;

  if (chosen === undefined) {
    const defaultResult = schema.safeParse(undefined);
    if (defaultResult.success) {
      return defaultResult.data;
    }

    const emptyObjectResult = schema.safeParse({});
    if (emptyObjectResult.success) {
      return emptyObjectResult.data;
    }

    if (allowUndefined) {
      return undefined;
    }
    console.warn(
      `Invalid data for blueprint "${context.blueprintName}" (${context.source}); falling back to undefined.`,
      defaultResult.error?.message ?? emptyObjectResult.error?.message
    );
    return undefined;
  }

  const parsed = schema.safeParse(chosen);
  if (parsed.success) {
    return parsed.data;
  }

  const fallbackParsed =
    chosen === fallback ? null : schema.safeParse(fallback);
  if (fallbackParsed?.success) {
    console.warn(
      `Invalid data for blueprint "${context.blueprintName}" (${context.source}); using fallback data.`,
      parsed.error?.message
    );
    return fallbackParsed.data;
  }
  console.warn(
    `Invalid data for blueprint "${context.blueprintName}" (${context.source}); falling back to undefined.`,
    parsed.error?.message ?? fallbackParsed?.error?.message
  );
  return undefined;
}

export function normalizeBlueprintData<TData>(
  blueprint: Blueprint<TData>
): Blueprint<TData> {
  const schema = dataSchemaFor(blueprint);
  if (!schema) return blueprint;
  return { ...blueprint, dataSchema: schema };
}

export function getBlueprintForThing(
  thing: RawThing,
  blueprintLookup: Map<string, Blueprint>
): Blueprint | undefined {
  return blueprintLookup.get(thing.blueprintName);
}

export function createThingFromBlueprint<TData = unknown>(
  blueprint: Blueprint<TData>,
  point: Vector,
  thing: Partial<RawThing<TData>> = {}
): RawThing<TData> {
  const width = thing.width ?? blueprint.width;
  const height = thing.height ?? blueprint.height;
  const x = thing.x ?? point.x - width / 2;
  const y = thing.y ?? point.y - height / 2;
  const schema = dataSchemaFor(blueprint);
  const data = validateThingData(
    schema,
    thing.data,
    undefined,
    { blueprintName: blueprint.name, source: "thing" },
    true
  );

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

export function sanitizeThingData(
  thing: RawThing,
  blueprintLookup: Map<string, Blueprint>
): RawThing {
  const blueprint = blueprintLookup.get(thing.blueprintName);
  if (!blueprint) {
    return thing;
  }
  const schema = dataSchemaFor(blueprint);
  const validated = validateThingData(
    schema,
    thing.data,
    undefined,
    { blueprintName: blueprint.name, source: "thing" },
    true
  );
  if (validated === thing.data) {
    return thing;
  }
  return { ...thing, data: validated };
}

type DefineBlueprintInput<Name extends string, TData> = {
  name: Name;
  schema?: ZodType<TData>;
  create: (
    data: BlueprintData<TData>
  ) => Blueprint<TData> | BlueprintModule<TData> | BlueprintData<TData>;
};

export function defineBlueprint<Name extends string, Schema extends ZodTypeAny>(
  input: DefineBlueprintInput<Name, z.infer<Schema>> & { schema: Schema }
): BlueprintDefinition<Name, z.infer<Schema>>;
export function defineBlueprint<Name extends string>(
  input: DefineBlueprintInput<Name, unknown>
): BlueprintDefinition<Name, unknown>;
export function defineBlueprint<Name extends string, TData = unknown>(
  input: DefineBlueprintInput<Name, TData>
): BlueprintDefinition<Name, TData> {
  const createBlueprint: BlueprintDefinition<Name, TData>["createBlueprint"] = (
    blueprintData
  ) => {
    const blueprintBody = input.create({ ...blueprintData, name: input.name });
    const merged: BlueprintKind<Name, TData> = {
      ...blueprintData,
      ...blueprintBody,
      name: input.name,
      ...(input.schema ? { dataSchema: input.schema } : {}),
    };

    return normalizeBlueprintData(merged) as BlueprintKind<Name, TData>;
  };

  const createThing: BlueprintDefinition<Name, TData>["createThing"] = (
    blueprint,
    point,
    overrides
  ) => createThingFromBlueprint(blueprint, point, overrides);

  const isThing: BlueprintDefinition<Name, TData>["isThing"] = (
    value
  ): value is RuntimeThing<TData> & { blueprintName: Name } =>
    hasBlueprintName(value) && value.blueprintName === input.name;

  return {
    name: input.name,
    dataSchema: input.schema,
    createBlueprint,
    createThing,
    isThing,
  };
}

export function isBlueprintDefinition(
  value: unknown
): value is BlueprintDefinition<string, unknown> {
  if (!hasBlueprintDefinitionShape(value)) {
    return false;
  }
  return (
    typeof value.name === "string" &&
    typeof value.createBlueprint === "function" &&
    typeof value.createThing === "function" &&
    typeof value.isThing === "function"
  );
}

function hasBlueprintDefinitionShape(value: unknown): value is {
  name: unknown;
  createBlueprint: unknown;
  createThing: unknown;
  isThing: unknown;
} {
  return (
    !!value &&
    typeof value === "object" &&
    "name" in value &&
    "createBlueprint" in value &&
    "createThing" in value &&
    "isThing" in value
  );
}
