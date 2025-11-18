export type KeyState = {
  arrowLeft: boolean;
  arrowRight: boolean;
  arrowUp: boolean;
  arrowDown: boolean;
  space: boolean;
  shift: boolean;
};

export type Vector = { x: number; y: number };

export type BlueprintData = {
  name: string;
  width: number;
  height: number;
  z: number;
  color: string;
};

export type BlueprintModule = Partial<{
  update: (thing: RuntimeThing, gameState: RuntimeGameState) => void;
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
  collision: (thing: RuntimeThing, otherThing: RuntimeThing) => void;
}>;

export type Blueprint = BlueprintData & BlueprintModule;

export type Thing = {
  id: string;
  x: number;
  y: number;
  z?: number;
  width?: number;
  height?: number;
  angle: number;
  velocityX: number;
  velocityY: number;
  physicsType: "static" | "dynamic";
  color?: string;
  blueprintName: string;
};

export type RuntimeThing = Thing &
  Required<Pick<Thing, keyof Omit<BlueprintData, "name">>>;

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
  things: Thing[];
};

export type PersistedGameState = Omit<RawGameState, "blueprints"> & {
  blueprints: BlueprintData[];
};

export type GameAction =
  | {
      type: "setThingProperty";
      thingId: string;
      property: keyof Thing;
      value: any;
    }
  | { type: "setThingProperties"; thingId: string; properties: Partial<Thing> }
  | { type: "addThing"; thing: Thing }
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
  | { type: "setCameraPosition"; x: number; y: number }
  | { type: "setScreenSize"; width: number; height: number }
  | { type: "setPaused"; isPaused: boolean }
  | { type: "setSelectedThingId"; thingId: string | null }
  | { type: "setSelectedThingIds"; thingIds: string[] };

export type GameFile = {
  things: Thing[];
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
