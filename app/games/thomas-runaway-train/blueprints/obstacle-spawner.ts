import {
  Blueprint,
  BlueprintData,
  GameContext,
  RuntimeThing,
} from "@/engine/types";
import { initializeApproach, TRACK_LANES } from "../obstacleApproach";

const SPAWNABLE_BLUEPRINT_NAMES = [
  "percy",
  "nia",
  "thomas",
  "sir-topham-hatt",
];
const SPAWN_INTERVAL_MS = 2000;

const lastSpawnTimes = new Map<string, number>();

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
