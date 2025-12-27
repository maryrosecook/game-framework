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

export type TriggerName = "create" | "input" | "update" | "collision";

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
  game: GameContext
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

export type BlueprintBehaviors = Partial<Record<TriggerName, string[]>>;

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
  z: number;
  color: string;
  image?: string;
  shape: Shape;
  physicsType: PhysicsType;
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
  z?: number;
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
        "name" | "physicsType" | "image" | "z" | "color" | "shape" | "behaviors"
      >
    >
  > & { color: string; isGrounded: boolean };

type TriggerHandlerMap = Omit<BlueprintHandlerMap, "render">;

export type TriggerHandler<T extends TriggerName = TriggerName> =
  TriggerHandlerMap[T];

export type ActionDefinition<T extends TriggerName = TriggerName> = {
  summary: string;
  code: TriggerHandler<T>;
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
