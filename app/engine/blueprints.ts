import { createThingId } from "@/lib/id";
import { z, type ZodType, type ZodTypeAny } from "zod";
import {
  ActionDefinition,
  ActionSettings,
  BehaviorAction,
  Blueprint,
  BlueprintData,
  BlueprintDefinition,
  BlueprintKind,
  BlueprintModule,
  COLLISION_TRIGGER_ANY,
  CollisionTriggerBlueprint,
  DEFAULT_THING_Z,
  GameContext,
  INPUT_KEYS,
  InputFrameState,
  InputTriggerKey,
  InputTriggerStage,
  KeyState,
  RawThing,
  RuntimeThing,
  TriggerHandler,
  TriggerName,
  Vector,
} from "./types";
import { actions as globalActions } from "./actions";
import { resolveActionSettings } from "./actions/settings";

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
  dataSchema: ZodType<TData> | undefined,
  candidate: TData | undefined,
  fallback: TData | undefined,
  context: DataContext,
  allowUndefined = false
): TData | undefined {
  if (!dataSchema) {
    return candidate ?? fallback;
  }

  const chosen = candidate === undefined ? fallback : candidate;

  if (chosen === undefined) {
    const defaultResult = dataSchema.safeParse(undefined);
    if (defaultResult.success) {
      return defaultResult.data;
    }

    const emptyObjectResult = dataSchema.safeParse({});
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

  const parsed = dataSchema.safeParse(chosen);
  if (parsed.success) {
    return parsed.data;
  }

  const fallbackParsed =
    chosen === fallback ? null : dataSchema.safeParse(fallback);
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

// Ensures that blueprint behaviors match the latest action definitions and have
// all defaults filled in.
export function normalizeBlueprintData<TData>(
  blueprint: Blueprint<TData>
): Blueprint<TData> {
  const schema = dataSchemaFor(blueprint);
  const normalizedBehaviors = normalizeBlueprintBehaviors(blueprint.behaviors);
  const withSchema = schema ? { ...blueprint, dataSchema: schema } : blueprint;
  if (normalizedBehaviors === undefined) {
    return withSchema;
  }
  return { ...withSchema, behaviors: normalizedBehaviors };
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
    z: thing.z ?? DEFAULT_THING_Z,
    angle: thing.angle ?? 0,
    velocityX: thing.velocityX ?? 0,
    velocityY: thing.velocityY ?? 0,
    isGrounded: false,
    blueprintName: thing.blueprintName ?? blueprint.name,
    width,
    height,
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
  dataSchema?: ZodType<TData>;
  create: (
    data: BlueprintData<TData>
  ) => Blueprint<TData> | BlueprintModule<TData> | BlueprintData<TData>;
};

export function defineBlueprint<Name extends string, Schema extends ZodTypeAny>(
  input: DefineBlueprintInput<Name, z.infer<Schema>> & { dataSchema: Schema }
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
      ...(input.dataSchema ? { dataSchema: input.dataSchema } : {}),
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
    dataSchema: input.dataSchema,
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

function doesActionSupportTrigger(
  action: ActionDefinition,
  trigger: TriggerName
): boolean {
  return action.allowedTriggers.includes(trigger);
}

type ActionHandlerFactoriesByTrigger = {
  [K in TriggerName]: (
    action: ActionDefinition,
    settings: ActionSettings
  ) => TriggerHandler<K>;
};

const actionHandlerFactoriesByTrigger: ActionHandlerFactoriesByTrigger = {
  create: (action, settings) => (thing, game) => {
    action.code({ thing, game, settings });
  },
  input: (action, settings) => (thing, game, keyState) => {
    action.code({ thing, game, keyState, settings });
  },
  update: (action, settings) => (thing, game, keyState) => {
    action.code({ thing, game, settings, keyState });
  },
  collision: (action, settings) => (thing, otherThing, game) => {
    action.code({ thing, otherThing, game, settings });
  },
};

function createActionHandlerForTrigger<T extends TriggerName>(
  trigger: T,
  action: ActionDefinition,
  settings: ActionSettings
): TriggerHandler<T> {
  return actionHandlerFactoriesByTrigger[trigger](action, settings);
}

type TriggerBehaviorAction = {
  action: BehaviorAction;
  inputKey?: InputTriggerKey;
  inputStage?: InputTriggerStage;
  collisionBlueprint?: CollisionTriggerBlueprint;
};

function getActionsForTrigger(
  blueprint: Blueprint | undefined,
  trigger: TriggerName
): TriggerBehaviorAction[] {
  const behaviors = blueprint?.behaviors;
  if (!behaviors) {
    return [];
  }
  const actions: TriggerBehaviorAction[] = [];
  for (const behavior of behaviors) {
    if (behavior.trigger !== trigger) {
      continue;
    }
    const inputKey = behavior.trigger === "input" ? behavior.key : undefined;
    const inputStage =
      behavior.trigger === "input" ? behavior.stage : undefined;
    const collisionBlueprint =
      behavior.trigger === "collision" ? behavior.blueprint : undefined;
    for (const action of behavior.actions) {
      actions.push({ action, inputKey, inputStage, collisionBlueprint });
    }
  }
  return actions;
}

// Ensures that blueprint behaviors match the latest action definitions and have
// all defaults filled in.
function normalizeBlueprintBehaviors(
  behaviors: Blueprint["behaviors"]
): Blueprint["behaviors"] {
  if (!behaviors) {
    return behaviors;
  }
  let changed = false;
  const nextBehaviors = behaviors.map((behavior) => {
    let entryChanged = false;
    const nextActions = behavior.actions.map((behaviorAction) => {
      const actionDefinition = globalActions[behaviorAction.action];
      if (!actionDefinition) {
        return behaviorAction;
      }
      const resolvedSettings = resolveActionSettings(
        actionDefinition.settings,
        behaviorAction.settings
      );
      if (areSettingsEqual(resolvedSettings, behaviorAction.settings)) {
        return behaviorAction;
      }
      entryChanged = true;
      return { ...behaviorAction, settings: resolvedSettings };
    });
    if (!entryChanged) {
      return behavior;
    }
    changed = true;
    return { ...behavior, actions: nextActions };
  });
  return changed ? nextBehaviors : behaviors;
}

function areSettingsEqual(left: ActionSettings, right: ActionSettings) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (const key of leftKeys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

function hasActiveInput(keyState: KeyState) {
  return INPUT_KEYS.some((key) => keyState[key]);
}

function isInputTriggerActive(
  inputKey: InputTriggerKey,
  stage: InputTriggerStage,
  inputFrame: InputFrameState
) {
  const stageState =
    stage === "press" ? inputFrame.pressed : inputFrame.keyState;
  if (inputKey === "any") {
    return hasActiveInput(stageState);
  }
  return stageState[inputKey];
}

type CollectedHandler<T extends TriggerName> = {
  name: string;
  fn: TriggerHandler<T>;
  inputTrigger?: { key: InputTriggerKey; stage: InputTriggerStage };
  collisionBlueprint?: CollisionTriggerBlueprint;
};

function collectBlueprintHandlers<T extends TriggerName>(
  trigger: T,
  blueprint: Blueprint | undefined,
  blueprintHandler: TriggerHandler<T> | undefined
): Array<CollectedHandler<T>> {
  const handlers: Array<CollectedHandler<T>> = [];

  if (blueprintHandler) {
    handlers.push({ name: "blueprint", fn: blueprintHandler });
  }

  for (const behaviorEntry of getActionsForTrigger(blueprint, trigger)) {
    const behaviorAction = behaviorEntry.action;
    const action = globalActions[behaviorAction.action];
    if (!action) {
      console.warn(
        `Action "${behaviorAction.action}" not found for trigger "${trigger}".`
      );
      continue;
    }
    if (!doesActionSupportTrigger(action, trigger)) {
      console.warn(
        `Action "${behaviorAction.action}" cannot run on trigger "${trigger}".`
      );
      continue;
    }
    const resolvedSettings = resolveActionSettings(
      action.settings,
      behaviorAction.settings
    );
    let inputTrigger: { key: InputTriggerKey; stage: InputTriggerStage } | undefined;
    let collisionBlueprint: CollisionTriggerBlueprint | undefined;
    if (trigger === "input") {
      if (
        behaviorEntry.inputKey === undefined ||
        behaviorEntry.inputStage === undefined
      ) {
        console.warn(
          `Input trigger missing key or stage for action "${behaviorAction.action}".`
        );
        continue;
      }
      inputTrigger = {
        key: behaviorEntry.inputKey,
        stage: behaviorEntry.inputStage,
      };
    } else if (trigger === "collision") {
      collisionBlueprint = behaviorEntry.collisionBlueprint;
    }
    handlers.push({
      name: behaviorAction.action,
      fn: createActionHandlerForTrigger(
        trigger,
        action,
        resolvedSettings
      ),
      ...(inputTrigger ? { inputTrigger } : {}),
      ...(collisionBlueprint !== undefined
        ? { collisionBlueprint }
        : {}),
    });
  }

  return handlers;
}

type RunBlueprintHandlersContext =
  | { inputFrame: InputFrameState }
  | { otherThing: RuntimeThing };

export function runBlueprintHandlers(
  trigger: "input",
  blueprint: Blueprint | undefined,
  blueprintHandler: TriggerHandler<"input"> | undefined,
  invoke: (handler: TriggerHandler<"input">) => void,
  context: { inputFrame: InputFrameState }
): boolean;
export function runBlueprintHandlers(
  trigger: "collision",
  blueprint: Blueprint | undefined,
  blueprintHandler: TriggerHandler<"collision"> | undefined,
  invoke: (handler: TriggerHandler<"collision">) => void,
  context: { otherThing: RuntimeThing }
): boolean;
export function runBlueprintHandlers<
  T extends Exclude<TriggerName, "input" | "collision">
>(
  trigger: T,
  blueprint: Blueprint | undefined,
  blueprintHandler: TriggerHandler<T> | undefined,
  invoke: (handler: TriggerHandler<T>) => void
): boolean;
export function runBlueprintHandlers<T extends TriggerName>(
  trigger: T,
  blueprint: Blueprint | undefined,
  blueprintHandler: TriggerHandler<T> | undefined,
  invoke: (handler: TriggerHandler<T>) => void,
  context?: RunBlueprintHandlersContext
): boolean {
  const handlers = collectBlueprintHandlers(
    trigger,
    blueprint,
    blueprintHandler
  );
  if (handlers.length === 0) {
    return false;
  }
  const inputFrame =
    context && "inputFrame" in context ? context.inputFrame : undefined;
  const otherThing =
    context && "otherThing" in context ? context.otherThing : undefined;

  for (const handler of handlers) {
    try {
      switch (trigger) {
        case "input": {
          if (handler.inputTrigger) {
            if (!inputFrame) {
              continue;
            }
            if (
              !isInputTriggerActive(
                handler.inputTrigger.key,
                handler.inputTrigger.stage,
                inputFrame
              )
            ) {
              continue;
            }
          }
          invoke(handler.fn);
          break;
        }
        case "collision": {
          if (!otherThing) {
            continue;
          }
          if (
            handler.collisionBlueprint &&
            handler.collisionBlueprint !== COLLISION_TRIGGER_ANY
          ) {
            if (otherThing.blueprintName !== handler.collisionBlueprint) {
              continue;
            }
          }
          invoke(handler.fn);
          break;
        }
        default:
          invoke(handler.fn);
      }
    } catch (error) {
      console.warn(
        `Error running ${trigger} handler "${handler.name}" for blueprint "${
          blueprint?.name ?? "unknown"
        }"`,
        error
      );
    }
  }

  return true;
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
