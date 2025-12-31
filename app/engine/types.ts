import type { ZodType } from "zod";

type BivariantHandler<TArgs extends unknown[], R> = {
  bivarianceHack(...args: TArgs): R;
}["bivarianceHack"];

export type KeyState = {
  arrowLeft: boolean;
  arrowRight: boolean;
  arrowUp: boolean;
  arrowDown: boolean;
  digit1: boolean;
  digit0: boolean;
  digit9: boolean;
  space: boolean;
  shift: boolean;
  keyW: boolean;
  keyA: boolean;
  keyS: boolean;
  keyD: boolean;
  keyE: boolean;
};

export type InputFrameState = {
  keyState: KeyState;
  pressed: KeyState;
  released: KeyState;
};

export type InputKey = keyof KeyState;

export const INPUT_KEYS: InputKey[] = [
  "arrowLeft",
  "arrowRight",
  "arrowUp",
  "arrowDown",
  "digit1",
  "digit0",
  "digit9",
  "space",
  "shift",
  "keyW",
  "keyA",
  "keyS",
  "keyD",
  "keyE",
];

export type InputTriggerKey = InputKey | "any";

export type InputTriggerStage = "press" | "hold";

export type TriggerName = "create" | "input" | "update" | "collision";

export type ActionSettingNumber = {
  kind: "number";
  default: number;
  min?: number;
  max?: number;
  step?: number;
};

export type ActionSettingString = {
  kind: "string";
  default: string;
  maxLength?: number;
  placeholder?: string;
};

export type ActionSettingBoolean = { kind: "boolean"; default: boolean };

export type ActionSettingEnum = {
  kind: "enum";
  default: string;
  options: string[];
};

export type ActionSetting =
  | ActionSettingNumber
  | ActionSettingString
  | ActionSettingBoolean
  | ActionSettingEnum;

export type ActionSettingValue = number | string | boolean;

export type ActionSettings = Record<string, ActionSettingValue>;

export type ActionSettingValueFor<T extends ActionSetting> =
  T extends ActionSettingNumber
    ? number
    : T extends ActionSettingString
    ? string
    : T extends ActionSettingBoolean
    ? boolean
    : T extends ActionSettingEnum
    ? string
    : never;

export type ActionSettingValues<
  TSettings extends Record<string, ActionSetting>
> = {
  [K in keyof TSettings]: ActionSettingValueFor<TSettings[K]>;
};

export type BehaviorAction = { action: string; settings: ActionSettings };

export type InputBlueprintBehavior = {
  trigger: "input";
  key: InputTriggerKey;
  stage: InputTriggerStage;
  actions: BehaviorAction[];
};

export type NonInputBlueprintBehavior = {
  trigger: Exclude<TriggerName, "input">;
  actions: BehaviorAction[];
};

export type BlueprintBehavior = InputBlueprintBehavior | NonInputBlueprintBehavior;

export type CreateHandler<TData = unknown> = (
  thing: RuntimeThing<TData>,
  game: GameContext
) => void;

export type InputHandler<TData = unknown> = (
  thing: RuntimeThing<TData>,
  game: GameContext,
  keyState: KeyState
) => void;

export type UpdateHandler<TData = unknown> = (
  thing: RuntimeThing<TData>,
  game: GameContext,
  keyState: KeyState
) => void;

export type CollisionHandler<TData = unknown> = (
  thing: RuntimeThing<TData>,
  otherThing: RuntimeThing,
  game: GameContext
) => void;

export type RenderHandler<TData = unknown> = (
  thing: RuntimeThing<TData>,
  game: GameContext,
  ctx: CanvasRenderingContext2D
) => void;

export type BlueprintHandlerMap<TData = unknown> = {
  create: CreateHandler<TData>;
  input: InputHandler<TData>;
  update: UpdateHandler<TData>;
  collision: CollisionHandler<TData>;
  render: RenderHandler<TData>;
};

export type BlueprintBehaviors = BlueprintBehavior[];

export type Vector = { x: number; y: number };

export type Shape = "rectangle" | "triangle" | "circle";
export type PhysicsType = "static" | "dynamic" | "ambient";

export type SpawnRequest = {
  blueprint: string | Blueprint;
  position: Vector;
  overrides?: Partial<RawThing>;
};

export type CollisionMap = Map<string, string[]>;

export type GameContext = {
  gameState: RuntimeGameState;
  collidingThingIds: CollisionMap;
  spawn: (request: SpawnRequest) => RuntimeThing | null;
  destroy: (target: RuntimeThing | string) => void;
  getImageForThing: (thing: RuntimeThing) => CanvasImageSource | null;
};

export type BlueprintData<TData = unknown> = {
  name: string;
  width: number;
  height: number;
  color: string;
  image?: string;
  shape: Shape;
  physicsType: PhysicsType;
  weight: number;
  bounce: number;
  behaviors?: BlueprintBehaviors;
};

export type BlueprintModule<TData = unknown> = Partial<
  BlueprintHandlerMap<TData>
> & {
  getAdjustedVelocity?: (
    // Adjust velocity in a custom way rather than using the physics default
    thing: RuntimeThing<TData>,
    proposedVelocity: Vector,
    game: GameContext
  ) => Vector;
};

export type Blueprint<TData = unknown> = BlueprintData<TData> &
  BlueprintModule<TData> & { dataSchema?: ZodType<TData> };

export type BlueprintDefinition<Name extends string, TData = unknown> = {
  name: Name;
  dataSchema?: ZodType<TData>;
  createBlueprint: BivariantHandler<
    [BlueprintData<TData>],
    BlueprintKind<Name, TData>
  >;
  createThing: BivariantHandler<
    [BlueprintKind<Name, TData>, Vector, Partial<RawThing<TData>>?],
    RawThing<TData>
  >;
  isThing: (
    value: RuntimeThing | RawThing | null | undefined
  ) => value is RuntimeThing<TData> & { blueprintName: Name };
};

export type RawThing<TData = unknown> = {
  id: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  angle: number;
  velocityX: number;
  velocityY: number;
  isGrounded: boolean;
  physicsType?: PhysicsType;
  blueprintName: string;
  data?: TData;
};

export type PersistedThing = Omit<RawThing, "isGrounded" | "data">;

export type RuntimeThing<TData = unknown> = RawThing<TData> &
  Required<
    Pick<
      RawThing,
      keyof Omit<
        BlueprintData,
        | "name"
        | "physicsType"
        | "image"
        | "color"
        | "shape"
        | "behaviors"
        | "weight"
        | "bounce"
      >
    >
  > & { color: string; isGrounded: boolean };

type TriggerHandlerMap = Omit<BlueprintHandlerMap, "render">;

export type TriggerHandler<T extends TriggerName = TriggerName> =
  TriggerHandlerMap[T];

type ActionContextBase<TSettings extends Record<string, ActionSetting>> = {
  thing: RuntimeThing;
  game: GameContext;
  settings: ActionSettingValues<TSettings>;
};

type ActionContextMap<TSettings extends Record<string, ActionSetting>> = {
  create: ActionContextBase<TSettings>;
  input: ActionContextBase<TSettings> & { keyState: KeyState };
  update: ActionContextBase<TSettings> & { keyState: KeyState };
  collision: ActionContextBase<TSettings> & { otherThing: RuntimeThing };
};

export type ActionContext<
  T extends TriggerName = TriggerName,
  TSettings extends Record<string, ActionSetting> = Record<
    string,
    ActionSetting
  >
> = ActionContextMap<TSettings>[T];

export type ActionHandler<
  T extends TriggerName = TriggerName,
  TSettings extends Record<string, ActionSetting> = Record<
    string,
    ActionSetting
  >
> = BivariantHandler<[ActionContext<T, TSettings>], void>;

export type ActionDefinition<
  T extends TriggerName = TriggerName,
  TSettings extends Record<string, ActionSetting> = Record<
    string,
    ActionSetting
  >
> = {
  settings: TSettings;
  code: ActionHandler<T, TSettings>;
  allowedTriggers: readonly T[];
};

export type RuntimeGameState = {
  things: RuntimeThing[];
  blueprints: Blueprint[];
  camera: Vector;
  screen: { width: number; height: number };
  backgroundColor: string;
  isGravityEnabled: boolean;
  isPaused: boolean;
  selectedThingId: string | null;
  selectedThingIds: string[];
};

export type RawGameState = Omit<RuntimeGameState, "things"> & {
  things: RawThing[];
  image?: string | null;
};

export type PersistedGameState = Omit<
  RawGameState,
  "blueprints" | "things" | "screen"
> & {
  id: number;
  blueprints: BlueprintData[];
  things: PersistedThing[];
};

export type CameraController = {
  update: (game: RuntimeGameState) => Vector;
};

type ThingPropertyUpdate = {
  [K in keyof RawThing]: { property: K; value: RawThing[K] };
}[keyof RawThing];

type BlueprintPropertyUpdate = {
  [K in keyof BlueprintData]: { property: K; value: BlueprintData[K] };
}[keyof BlueprintData];

type ThingPropertyAction = {
  type: "setThingProperty";
  thingId: string;
} & ThingPropertyUpdate;

type BlueprintPropertyAction = {
  type: "setBlueprintProperty";
  blueprintName: string;
} & BlueprintPropertyUpdate;

export type SetThingPropertyAction = ThingPropertyAction;
export type SetBlueprintPropertyAction = BlueprintPropertyAction;
export type SpecificBlueprintPropertyAction<K extends keyof BlueprintData> = {
  type: "setBlueprintProperty";
  blueprintName: string;
  property: K;
  value: BlueprintData[K];
};

export type GameAction =
  | ThingPropertyAction
  | {
      type: "setThingProperties";
      thingId: string;
      properties: Partial<RawThing>;
    }
  | { type: "addThing"; thing: RawThing }
  | { type: "removeThing"; thingId: string }
  | BlueprintPropertyAction
  | {
      type: "setBlueprintProperties";
      blueprintName: string;
      properties: Partial<BlueprintData>;
    }
  | { type: "addBlueprint"; blueprint: Blueprint }
  | { type: "removeBlueprint"; blueprintName: string }
  | { type: "renameBlueprint"; previousName: string; nextName: string }
  | { type: "setCameraPosition"; x: number; y: number }
  | { type: "setGravityEnabled"; isGravityEnabled: boolean }
  | { type: "setPaused"; isPaused: boolean }
  | { type: "setSelectedThingId"; thingId: string | null }
  | { type: "setSelectedThingIds"; thingIds: string[] }
  | { type: "setBackgroundColor"; color: string };

export type GameFile = {
  id: number;
  things: PersistedThing[];
  blueprints: BlueprintData[];
  camera: Vector;
  backgroundColor?: string;
  clearColor?: string;
  isGravityEnabled: boolean;
  image?: string | null;
};

export type SubscriptionPath =
  | ["things", string]
  | ["things", string, keyof RuntimeThing]
  | ["things"]
  | ["blueprints"]
  | ["blueprints", string]
  | ["camera"]
  | ["screen"]
  | ["isGravityEnabled"]
  | ["backgroundColor"]
  | ["isPaused"]
  | ["selectedThingId"]
  | ["selectedThingIds"];

export type InferBlueprintData<T> = T extends BlueprintDefinition<
  infer _N,
  infer D
>
  ? D
  : T extends BlueprintData<infer D>
  ? D
  : T extends Blueprint<infer D>
  ? D
  : unknown;

export type InferBlueprintName<T> = T extends BlueprintDefinition<infer N, any>
  ? N
  : T extends { name: infer N extends string }
  ? N
  : string;

export type BlueprintKind<
  Name extends string,
  TData = unknown
> = Blueprint<TData> & {
  name: Name;
};

export type BlueprintInstance<
  Def extends BlueprintDefinition<string, unknown>
> = ReturnType<Def["createBlueprint"]>;

export type BlueprintThing<Def> = Def extends BlueprintDefinition<
  infer N,
  infer D
>
  ? RuntimeThing<D> & { blueprintName: N }
  : never;

export type ThingForBlueprint<B extends BlueprintKind<string, unknown>> =
  RuntimeThing<InferBlueprintData<B>> & {
    blueprintName: B["name"];
    data: InferBlueprintData<B>;
  };

export type ThingFromBlueprints<
  Bs extends readonly BlueprintKind<string, unknown>[]
> = {
  [K in Bs[number] as K["name"]]: ThingForBlueprint<
    Extract<Bs[number], { name: K["name"] }>
  >;
}[Bs[number]["name"]];

const MIN_BLUEPRINT_WEIGHT = 0.0001;
export const DEFAULT_THING_Z = 1;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isNotFoundError(
  error: unknown
): error is NodeJS.ErrnoException {
  return isRecord(error) && "code" in error && error.code === "ENOENT";
}

export function isExistingFileError(
  error: unknown
): error is NodeJS.ErrnoException {
  return isRecord(error) && "code" in error && error.code === "EEXIST";
}

export function isEditorSettings(value: unknown): value is {
  currentGameDirectory: string;
} {
  return isRecord(value) && typeof value.currentGameDirectory === "string";
}

export function isVector(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}

export function isShape(value: unknown): value is Shape {
  return value === "rectangle" || value === "triangle" || value === "circle";
}

export function isPhysicsType(value: unknown): value is PhysicsType {
  return value === "dynamic" || value === "static" || value === "ambient";
}

export function isTriggerName(value: string): value is TriggerName {
  return (
    value === "create" ||
    value === "input" ||
    value === "update" ||
    value === "collision"
  );
}

export function isInputKey(value: string): value is InputKey {
  return INPUT_KEYS.some((key) => key === value);
}

export function isInputTriggerKey(value: unknown): value is InputTriggerKey {
  return (
    typeof value === "string" && (value === "any" || isInputKey(value))
  );
}

export function isInputTriggerStage(value: unknown): value is InputTriggerStage {
  return value === "press" || value === "hold";
}

export function isActionSettings(
  value: unknown
): value is Record<string, string | number | boolean> {
  if (!isRecord(value)) {
    return false;
  }
  for (const entry of Object.values(value)) {
    if (
      typeof entry !== "string" &&
      typeof entry !== "number" &&
      typeof entry !== "boolean"
    ) {
      return false;
    }
  }
  return true;
}

export function isBehaviorAction(value: unknown): value is BehaviorAction {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.action !== "string") {
    return false;
  }
  return isActionSettings(value.settings);
}

export function isBlueprintBehavior(
  value: unknown
): value is BlueprintBehavior {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.trigger !== "string" || !isTriggerName(value.trigger)) {
    return false;
  }
  if (value.trigger === "input") {
    if (!("key" in value)) {
      return false;
    }
    if (!("stage" in value)) {
      return false;
    }
    if (!isInputTriggerKey(value.key)) {
      return false;
    }
    if (!isInputTriggerStage(value.stage)) {
      return false;
    }
  } else if ("key" in value) {
    return false;
  } else if ("stage" in value) {
    return false;
  }
  if (
    !Array.isArray(value.actions) ||
    !value.actions.every((item) => isBehaviorAction(item))
  ) {
    return false;
  }
  return true;
}

export function isBlueprintBehaviors(
  value: unknown
): value is BlueprintBehaviors {
  return (
    Array.isArray(value) && value.every((entry) => isBlueprintBehavior(entry))
  );
}

export function isThing(value: unknown): value is PersistedThing {
  if (!isRecord(value)) {
    return false;
  }
  const hasRequiredFields =
    typeof value.id === "string" &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number" &&
    typeof value.angle === "number" &&
    typeof value.velocityX === "number" &&
    typeof value.velocityY === "number" &&
    typeof value.blueprintName === "string";
  if (!hasRequiredFields) {
    return false;
  }

  const numericOptionalKeys: (keyof Pick<
    PersistedThing,
    "width" | "height"
  >)[] = ["width", "height"];
  const hasValidOptionalNumbers = numericOptionalKeys.every(
    (key) => value[key] === undefined || typeof value[key] === "number"
  );
  if (!hasValidOptionalNumbers) {
    return false;
  }

  if (value.physicsType !== undefined && !isPhysicsType(value.physicsType)) {
    return false;
  }
  if (value.color !== undefined && typeof value.color !== "string") {
    return false;
  }
  if (value.shape !== undefined) {
    return false;
  }
  return true;
}

export function isBlueprintData(value: unknown): value is BlueprintData {
  if (!isRecord(value)) {
    return false;
  }
  if ("z" in value) {
    return false;
  }
  if (
    typeof value.name !== "string" ||
    typeof value.width !== "number" ||
    typeof value.height !== "number" ||
    typeof value.color !== "string" ||
    !isShape(value.shape) ||
    !isPhysicsType(value.physicsType)
  ) {
    return false;
  }
  if (value.image !== undefined && typeof value.image !== "string") {
    return false;
  }
  if (
    typeof value.weight !== "number" ||
    !Number.isFinite(value.weight) ||
    value.weight < MIN_BLUEPRINT_WEIGHT
  ) {
    return false;
  }
  if (
    typeof value.bounce !== "number" ||
    !Number.isFinite(value.bounce) ||
    value.bounce < 0 ||
    value.bounce > 1
  ) {
    return false;
  }
  if (value.behaviors !== undefined && !isBlueprintBehaviors(value.behaviors)) {
    return false;
  }
  return true;
}

export function isGameFile(value: unknown): value is GameFile {
  if (!isRecord(value)) {
    return false;
  }
  const hasValidId = typeof value.id === "number";
  const hasCamera = isVector(value.camera);
  const hasThings =
    Array.isArray(value.things) &&
    value.things.every((thing) => isThing(thing));
  const hasBlueprints =
    Array.isArray(value.blueprints) &&
    value.blueprints.every((bp) => isBlueprintData(bp));
  const hasBackgroundColor =
    value.backgroundColor === undefined ||
    typeof value.backgroundColor === "string" ||
    value.clearColor === undefined ||
    typeof value.clearColor === "string";
  const hasValidImage =
    value.image === undefined ||
    value.image === null ||
    typeof value.image === "string";
  const hasGravitySetting = typeof value.isGravityEnabled === "boolean";
  return (
    hasValidId &&
    hasCamera &&
    hasThings &&
    hasBlueprints &&
    hasBackgroundColor &&
    hasValidImage &&
    hasGravitySetting
  );
}
