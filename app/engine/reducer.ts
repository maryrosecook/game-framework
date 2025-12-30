import { Blueprint, GameAction, RawThing, RawGameState } from "./types";
import { renameSpawnObjectBlueprints } from "./actions/behaviorActions";

export function reduceState(
  state: RawGameState,
  action: GameAction
): RawGameState {
  switch (action.type) {
    case "setThingProperty":
      return updateThing(state, action.thingId, (thing) => ({
        ...thing,
        [action.property]: action.value,
      }));
    case "setThingProperties":
      return updateThing(state, action.thingId, (thing) => ({
        ...thing,
        ...action.properties,
      }));
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
      return updateBlueprint(state, action.blueprintName, (blueprint) => ({
        ...blueprint,
        [action.property]: action.value,
      }));
    case "setBlueprintProperties":
      return updateBlueprint(state, action.blueprintName, (blueprint) => ({
        ...blueprint,
        ...action.properties,
      }));
    case "addBlueprint":
      return {
        ...state,
        blueprints: [...state.blueprints, action.blueprint],
      };
    case "removeBlueprint": {
      const remainingThings = state.things.filter(
        (thing) => thing.blueprintName !== action.blueprintName
      );
      const removedThingIds = new Set(
        state.things
          .filter((thing) => thing.blueprintName === action.blueprintName)
          .map((thing) => thing.id)
      );
      const remainingSelectedIds = state.selectedThingIds.filter(
        (id) => !removedThingIds.has(id)
      );
      const selectedThingId = removedThingIds.has(
        state.selectedThingId ?? ""
      )
        ? remainingSelectedIds[remainingSelectedIds.length - 1] ?? null
        : state.selectedThingId;

      return {
        ...state,
        blueprints: state.blueprints.filter(
          (bp) => bp.name !== action.blueprintName
        ),
        things: remainingThings,
        selectedThingIds: remainingSelectedIds,
        selectedThingId,
      };
    }
    case "renameBlueprint":
      return renameBlueprint(state, action.previousName, action.nextName);
    case "setCameraPosition":
      return {
        ...state,
        camera: { x: action.x, y: action.y },
      };
    case "setGravityEnabled":
      return {
        ...state,
        isGravityEnabled: action.isGravityEnabled,
      };
    case "setBackgroundColor":
      return {
        ...state,
        backgroundColor: action.color,
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
  updater: (thing: RawThing) => RawThing
): RawGameState {
  const index = state.things.findIndex((thing) => thing.id === thingId);
  if (index < 0) {
    return state;
  }
  const things = [...state.things];
  const nextThing = updater({ ...things[index] });
  things[index] = nextThing;
  return { ...state, things };
}

function updateBlueprint(
  state: RawGameState,
  blueprintName: string,
  updater: (blueprint: Blueprint) => Blueprint
): RawGameState {
  const index = state.blueprints.findIndex((bp) => bp.name === blueprintName);
  if (index < 0) {
    return state;
  }
  const blueprints = [...state.blueprints];
  blueprints[index] = updater({ ...blueprints[index] });
  return { ...state, blueprints };
}

function renameBlueprint(state: RawGameState, previous: string, next: string) {
  const hasBlueprint = state.blueprints.some((bp) => bp.name === previous);
  if (!hasBlueprint) {
    return state;
  }
  const blueprints = state.blueprints.map((bp) => {
    const renamed = bp.name === previous ? { ...bp, name: next } : bp;
    const updatedBehaviors = renameSpawnObjectBlueprints(
      renamed.behaviors,
      previous,
      next
    );
    if (updatedBehaviors === renamed.behaviors) {
      return renamed;
    }
    return { ...renamed, behaviors: updatedBehaviors };
  });
  const things = state.things.map((thing) =>
    thing.blueprintName === previous ? { ...thing, blueprintName: next } : thing
  );

  return {
    ...state,
    blueprints,
    things,
  };
}
