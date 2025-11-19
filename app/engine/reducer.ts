import { Blueprint, GameAction, RawThing, RawGameState } from "./types";

export function reduceState(
  state: RawGameState,
  action: GameAction
): RawGameState {
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
        things: [...state.things, { ...action.thing }],
      };
    case "removeThing":
      const remainingSelectedIds = state.selectedThingIds.filter(
        (id) => id !== action.thingId
      );
      return {
        ...state,
        things: state.things.filter((thing) => thing.id !== action.thingId),
        selectedThingId:
          state.selectedThingId === action.thingId
            ? remainingSelectedIds[remainingSelectedIds.length - 1] ?? null
            : state.selectedThingId,
        selectedThingIds: remainingSelectedIds,
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
    case "renameBlueprint":
      return renameBlueprint(state, action.previousName, action.nextName);
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
        selectedThingIds: action.thingId ? [action.thingId] : [],
      };
    case "setSelectedThingIds": {
      const unique = Array.from(new Set(action.thingIds));
      return {
        ...state,
        selectedThingIds: unique,
        selectedThingId: unique.length > 0 ? unique[unique.length - 1] : null,
      };
    }
    default:
      return state;
  }
}

function updateThing(
  state: RawGameState,
  thingId: string,
  updater: (thing: RawThing) => void
): RawGameState {
  const index = state.things.findIndex((thing) => thing.id === thingId);
  if (index < 0) {
    return state;
  }
  const things = [...state.things];
  const nextThing = { ...things[index] };
  updater(nextThing);
  things[index] = nextThing;
  return { ...state, things };
}

function updateBlueprint(
  state: RawGameState,
  blueprintName: string,
  updater: (blueprint: Blueprint) => void
): RawGameState {
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

function renameBlueprint(state: RawGameState, previous: string, next: string) {
  const normalizedPrev = normalizeName(previous);
  const normalizedNext = normalizeName(next);
  const blueprintIndex = state.blueprints.findIndex(
    (bp) => normalizeName(bp.name) === normalizedPrev
  );
  if (blueprintIndex < 0) {
    return state;
  }
  const blueprints = [...state.blueprints];
  blueprints[blueprintIndex] = { ...blueprints[blueprintIndex], name: next };
  const things = state.things.map((thing) =>
    normalizeName(thing.blueprintName) === normalizedPrev
      ? { ...thing, blueprintName: next }
      : thing
  );

  return {
    ...state,
    blueprints,
    things,
  };
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase();
}
