export type KeyState = {
  arrowLeft: boolean;
  arrowRight: boolean;
  arrowUp: boolean;
  arrowDown: boolean;
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

export type Vector = { x: number; y: number };

export type Shape = "rectangle" | "triangle";
export type PhysicsType = "static" | "dynamic" | "ambient";

export type SpawnRequest = {
  blueprint: string | Blueprint;
  position: Vector;
  overrides?: Partial<RawThing>;
};

export type UpdateCommand =
  | { type: "spawn"; request: SpawnRequest }
  | { type: "destroy"; id: string };

export type UpdateResult = void | UpdateCommand | UpdateCommand[];

export type CollisionMap = Map<string, string[]>;

export type GameContext = {
  gameState: RuntimeGameState;
  collidingThingIds: CollisionMap;
  spawn: (request: SpawnRequest) => RuntimeThing | null;
  destroy: (target: RuntimeThing | string) => void;
};

export type BlueprintData = {
  name: string;
  width: number;
  height: number;
  z: number;
  color: string;
  image?: string;
  shape: Shape;
  physicsType: PhysicsType;
};

export type BlueprintModule = Partial<{
  update: (thing: RuntimeThing, game: GameContext) => UpdateResult;
  render: (
    thing: RuntimeThing,
    game: GameContext,
    ctx: CanvasRenderingContext2D
  ) => void;
  input: (
    thing: RuntimeThing,
    game: GameContext,
    keyState: KeyState
  ) => void;
  collision: (
    thing: RuntimeThing,
    otherThing: RuntimeThing,
    game: GameContext
  ) => void;
  getAdjustedVelocity: (
    thing: RuntimeThing,
    proposedVelocity: Vector,
    game: GameContext
  ) => Vector;
}>;

export type Blueprint = BlueprintData & BlueprintModule;

export type RawThing = {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle: number;
  velocityX: number;
  velocityY: number;
  physicsType?: PhysicsType;
  shape?: Shape;
  blueprintName: string;
};

export type RuntimeThing = RawThing &
  Required<
    Pick<
      RawThing,
      keyof Omit<BlueprintData, "name" | "physicsType" | "image" | "z" | "color">
    >
  > & { color: string };

export type RuntimeGameState = {
  things: RuntimeThing[];
  blueprints: Blueprint[];
  camera: Vector;
  screen: { width: number; height: number };
  backgroundColor: string;
  isPaused: boolean;
  selectedThingId: string | null;
  selectedThingIds: string[];
};

export type RawGameState = Omit<RuntimeGameState, "things"> & {
  things: RawThing[];
  image?: string | null;
};

export type PersistedGameState = Omit<RawGameState, "blueprints"> & {
  blueprints: BlueprintData[];
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
  | { type: "setScreenSize"; width: number; height: number }
  | { type: "setPaused"; isPaused: boolean }
  | { type: "setSelectedThingId"; thingId: string | null }
  | { type: "setSelectedThingIds"; thingIds: string[] }
  | { type: "setBackgroundColor"; color: string };

export type GameFile = {
  things: RawThing[];
  blueprints: BlueprintData[];
  camera: Vector;
  screen: { width: number; height: number };
  backgroundColor?: string;
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
  | ["backgroundColor"]
  | ["isPaused"]
  | ["selectedThingId"]
  | ["selectedThingIds"];
