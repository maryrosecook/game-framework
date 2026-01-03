import {
  Blueprint,
  BlueprintData,
  GameContext,
  RuntimeThing,
} from "@/engine/types";
import {
  initializeApproach,
  initializeSideApproach,
  TRACK_LANES,
  TrackLane,
} from "../obstacleApproach";

const SPAWNABLE_BLUEPRINT_NAMES = ["percy", "nia", "thomas"];
const SPAWN_INTERVAL_MS = 2000;
const TREE_SPAWN_INTERVAL_MS = 200;
const TREE_LANES: readonly TrackLane[] = ["left", "right"] as const;

const lastSpawnTimes = new Map<string, number>();
const lastTreeSpawnTimes = new Map<string, number>();

const nowMs = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export default function createObstacleSpawner(data: BlueprintData) {
  return {
    ...data,
    update: (thing: RuntimeThing, game: GameContext) => {
      if (game.gameState.isPaused) {
        return;
      }
      const now = nowMs();
      maybeSpawnTree(thing, game, now);

      if (hasActiveSpawnable(game)) {
        return;
      }
      const lastSpawn = lastSpawnTimes.get(thing.id) ?? 0;
      if (now - lastSpawn < SPAWN_INTERVAL_MS) {
        return;
      }
      lastSpawnTimes.set(thing.id, now);
      spawnObstacle(game);
    },
    render: (
      _thing: RuntimeThing,
      _game: GameContext,
      _ctx: CanvasRenderingContext2D
    ) => {},
  };
}

function spawnObstacle(game: GameContext) {
  const blueprint = pickBlueprint(game);
  if (!blueprint) return;

  const lane =
    TRACK_LANES[Math.floor(Math.random() * TRACK_LANES.length)] ?? "center";

  const thing = game.spawn({
    blueprint,
    position: {
      x: game.gameState.screen.width / 2,
      y: game.gameState.screen.height / 2,
    },
  });

  if (!thing) {
    return;
  }

  initializeApproach(thing, game, lane, {
    width: blueprint.width,
    height: blueprint.height,
  });
}

function maybeSpawnTree(thing: RuntimeThing, game: GameContext, now: number) {
  const lastTreeSpawn = lastTreeSpawnTimes.get(thing.id) ?? 0;
  if (now - lastTreeSpawn < TREE_SPAWN_INTERVAL_MS) {
    return;
  }
  if (spawnTree(game)) {
    lastTreeSpawnTimes.set(thing.id, now);
  }
}

function spawnTree(game: GameContext): boolean {
  const blueprint = pickTreeBlueprint(game);
  if (!blueprint) return false;

  const lane =
    TREE_LANES[Math.floor(Math.random() * TREE_LANES.length)] ?? "left";

  const treeThing = game.spawn({
    blueprint,
    position: {
      x: game.gameState.screen.width / 2,
      y: game.gameState.screen.height / 2,
    },
  });

  if (!treeThing) {
    return false;
  }

  initializeSideApproach(treeThing, game, lane, {
    width: blueprint.width,
    height: blueprint.height,
  });

  return true;
}

function pickBlueprint(game: GameContext): Blueprint | null {
  const options = game.gameState.blueprints.filter((blueprint) =>
    SPAWNABLE_BLUEPRINT_NAMES.includes(blueprint.name)
  );
  if (options.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? null;
}

function pickTreeBlueprint(game: GameContext): Blueprint | null {
  return (
    game.gameState.blueprints.find((blueprint) => blueprint.name === "tree") ??
    null
  );
}

function hasActiveSpawnable(game: GameContext): boolean {
  return game.gameState.things.some((thing) =>
    SPAWNABLE_BLUEPRINT_NAMES.includes(thing.blueprintName)
  );
}
