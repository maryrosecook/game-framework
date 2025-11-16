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
  update: (thing: Thing, gameState: GameState) => void;
  render: (
    thing: Thing,
    gameState: GameState,
    ctx: CanvasRenderingContext2D
  ) => void;
  input: (thing: Thing, gameState: GameState, keyState: KeyState) => void;
  collision: (thing: Thing, otherThing: Thing) => void;
}>;

export type Blueprint = BlueprintData & BlueprintModule;

export type InheritableThingKeys = "width" | "height" | "z" | "color";

export type Thing = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  angle: number;
  velocity: Vector;
  physicsType: "static" | "dynamic";
  color: string;
  blueprintName: string;
  proto?: Blueprint;
  inherits?: Partial<Record<InheritableThingKeys, boolean>>;
};

export type GameState = {
  things: Thing[];
  blueprints: Blueprint[];
  camera: Vector;
  screen: { width: number; height: number };
  isPaused: boolean;
  selectedThingId: string | null;
};

export type PersistedGameState = Omit<GameState, "blueprints"> & {
  blueprints: BlueprintData[];
};

export type GameAction =
  | { type: "setThingProperty"; thingId: string; property: keyof Thing; value: any }
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
  | { type: "setSelectedThingId"; thingId: string | null };

export type GameFile = {
  things: Thing[];
  blueprints: BlueprintData[];
  camera: Vector;
  screen: { width: number; height: number };
};

export type SubscriptionPath =
  | ["things", string]
  | ["things", string, keyof Thing]
  | ["things"]
  | ["blueprints"]
  | ["blueprints", string]
  | ["camera"]
  | ["screen"]
  | ["isPaused"]
  | ["selectedThingId"];
