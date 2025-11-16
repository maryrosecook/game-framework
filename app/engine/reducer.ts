import { Blueprint, GameAction, GameState, Thing } from "./types";

export function reduceState(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "setThingProperty":
      return updateThing(state, action.thingId, (thing) => {
        (thing as Record<string, unknown>)[action.property] = action.value;
      });
    case "setThingProperties":
      return updateThing(state, action.thingId, (thing) => {
        Object.assign(thing, action.properties);
      });
    case "addThing":
      return {
        ...state,
        things: [...state.things, structuredThingCopy(action.thing)],
      };
    case "removeThing":
      return {
        ...state,
        things: state.things.filter((thing) => thing.id !== action.thingId),
        selectedThingId:
          state.selectedThingId === action.thingId
            ? null
            : state.selectedThingId,
      };
    case "setBlueprintProperty":
      return updateBlueprint(state, action.blueprintName, (blueprint) => {
        (blueprint as Record<string, unknown>)[action.property] = action.value;
      });
    case "setBlueprintProperties":
      return updateBlueprint(state, action.blueprintName, (blueprint) => {
        Object.assign(blueprint, action.properties);
      });
    case "addBlueprint":
      return {
        ...state,
        blueprints: [...state.blueprints, action.blueprint],
      };
    case "removeBlueprint":
      return {
        ...state,
        blueprints: state.blueprints.filter(
          (bp) => normalizeName(bp.name) !== normalizeName(action.blueprintName)
        ),
      };
    case "setCameraPosition":
      return {
        ...state,
        camera: { x: action.x, y: action.y },
      };
    case "setScreenSize":
      return {
        ...state,
        screen: { width: action.width, height: action.height },
      };
    case "setPaused":
      return {
        ...state,
        isPaused: action.isPaused,
      };
    case "setSelectedThingId":
      return {
        ...state,
        selectedThingId: action.thingId,
      };
    default:
      return state;
  }
}

function updateThing(
  state: GameState,
  thingId: string,
  updater: (thing: Thing) => void
): GameState {
  const index = state.things.findIndex((thing) => thing.id === thingId);
  if (index < 0) {
    return state;
  }
  const things = [...state.things];
  const nextThing = structuredThingCopy(things[index]);
  updater(nextThing);
  things[index] = nextThing;
  return { ...state, things };
}

function updateBlueprint(
  state: GameState,
  blueprintName: string,
  updater: (blueprint: Blueprint) => void
): GameState {
  const index = state.blueprints.findIndex(
    (bp) => normalizeName(bp.name) === normalizeName(blueprintName)
  );
  if (index < 0) {
    return state;
  }
  const blueprints = [...state.blueprints];
  const clone = { ...blueprints[index] };
  updater(clone);
  blueprints[index] = clone;
  return { ...state, blueprints };
}

export function structuredThingCopy(thing: Thing): Thing {
  return {
    ...thing,
    velocity: { ...thing.velocity },
    inherits: thing.inherits ? { ...thing.inherits } : undefined,
  };
}

export function normalizeName(name: string) {
  return name.trim().toLowerCase();
}
