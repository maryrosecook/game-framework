export type KeyState = {
  arrowLeft: boolean;
  arrowRight: boolean;
  arrowUp: boolean;
  arrowDown: boolean;
  space: boolean;
  shift: boolean;
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

export type UpdateContext = {
  thing: RuntimeThing;
  things: ReadonlyArray<RuntimeThing>;
  game: Readonly<Omit<RuntimeGameState, "things">>;
  spawn: (request: SpawnRequest) => RuntimeThing | null;
  destroy: (target: RuntimeThing | string) => void;
};

export type BlueprintData = {
  name: string;
  width: number;
  height: number;
  z: number;
  color: string;
  shape: Shape;
  physicsType: PhysicsType;
};

export type BlueprintModule = Partial<{
  update: (context: UpdateContext) => UpdateResult;
  render: (
    thing: RuntimeThing,
    gameState: RuntimeGameState,
    ctx: CanvasRenderingContext2D
  ) => void;
  input: (
    thing: RuntimeThing,
    gameState: RuntimeGameState,
    keyState: KeyState
  ) => void;
  collision: (
    thing: RuntimeThing,
    otherThing: RuntimeThing,
    gameState: RuntimeGameState
  ) => void;
}>;

export type Blueprint = BlueprintData & BlueprintModule;

export type RawThing = {
  id: string;
  x: number;
  y: number;
  z?: number;
  width?: number;
  height?: number;
  angle: number;
  velocityX: number;
  velocityY: number;
  physicsType?: PhysicsType;
  color?: string;
  shape?: Shape;
  blueprintName: string;
};

export type RuntimeThing = RawThing &
  Required<Pick<RawThing, keyof Omit<BlueprintData, "name" | "physicsType">>>;

export type RuntimeGameState = {
  things: RuntimeThing[];
  blueprints: Blueprint[];
  camera: Vector;
  screen: { width: number; height: number };
  isPaused: boolean;
  selectedThingId: string | null;
  selectedThingIds: string[];
};

export type RawGameState = Omit<RuntimeGameState, "things"> & {
  things: RawThing[];
};

export type PersistedGameState = Omit<RawGameState, "blueprints"> & {
  blueprints: BlueprintData[];
};

export type CameraController = {
  update: (game: RuntimeGameState) => Vector;
};

export type GameAction =
  | {
      type: "setThingProperty";
      thingId: string;
      property: keyof RawThing;
      value: any;
    }
  | {
      type: "setThingProperties";
      thingId: string;
      properties: Partial<RawThing>;
    }
  | { type: "addThing"; thing: RawThing }
  | { type: "removeThing"; thingId: string }
  | {
      type: "setBlueprintProperty";
      blueprintName: string;
      property: keyof Blueprint;
      value: any;
    }
  | {
      type: "setBlueprintProperties";
      blueprintName: string;
      properties: Partial<Blueprint>;
    }
  | { type: "addBlueprint"; blueprint: Blueprint }
  | { type: "removeBlueprint"; blueprintName: string }
  | { type: "renameBlueprint"; previousName: string; nextName: string }
  | { type: "setCameraPosition"; x: number; y: number }
  | { type: "setScreenSize"; width: number; height: number }
  | { type: "setPaused"; isPaused: boolean }
  | { type: "setSelectedThingId"; thingId: string | null }
  | { type: "setSelectedThingIds"; thingIds: string[] };

export type GameFile = {
  things: RawThing[];
  blueprints: BlueprintData[];
  camera: Vector;
  screen: { width: number; height: number };
};

export type SubscriptionPath =
  | ["things", string]
  | ["things", string, keyof RuntimeThing]
  | ["things"]
  | ["blueprints"]
  | ["blueprints", string]
  | ["camera"]
  | ["screen"]
  | ["isPaused"]
  | ["selectedThingId"]
  | ["selectedThingIds"];
