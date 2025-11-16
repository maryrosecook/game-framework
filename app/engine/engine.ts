import { InputManager } from "./input";
import { physicsStep } from "./physics";
import { renderGame } from "./render";
import {
  Blueprint,
  BlueprintData,
  GameAction,
  GameFile,
  GameState,
  InheritableThingKeys,
  PersistedGameState,
  SubscriptionPath,
  Thing,
} from "./types";
import { blueprintSlug } from "@/lib/blueprints";
import { normalizeName, reduceState, structuredThingCopy } from "./reducer";
import { getBlueprintForThing } from "./blueprints";

type LoadedGameResponse = {
  game: GameFile;
  gameDirectory: string;
};

const INHERITABLE_PROPERTIES: InheritableThingKeys[] = [
  "width",
  "height",
  "z",
  "color",
];

const DEFAULT_GAME_STATE: GameState = {
  things: [],
  blueprints: [],
  camera: { x: 0, y: 0 },
  screen: { width: 800, height: 600 },
  isPaused: true,
  selectedThingId: null,
  selectedThingIds: [],
};

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameHandle: number | null = null;
  private resizeListener = () => this.resizeCanvas();
  private inputManager: InputManager | null = null;
  private listeners = new Set<() => void>();
  private gameState: GameState = { ...DEFAULT_GAME_STATE };
  private persistedGameState: PersistedGameState = {
    ...DEFAULT_GAME_STATE,
    blueprints: [],
  };
  private gameDirectory = "";
  private viewportSize = { width: 0, height: 0 };
  private persistHandle: number | null = null;
  private ready = false;
  private blueprintLookup = new Map<string, Blueprint>();
  private thingHashes = new Map<string, string>();

  async initialize(canvas: HTMLCanvasElement) {
    if (this.canvas === canvas && this.ready) {
      return;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    if (typeof window !== "undefined") {
      this.resizeCanvas();
      window.addEventListener("resize", this.resizeListener);
      if (!this.inputManager) {
        this.inputManager = new InputManager();
      }
      this.inputManager.attach();
    }

    await this.loadGame();
    this.ready = true;
    this.startLoop();
    this.notify();
  }

  destroy() {
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.resizeListener);
    }
    this.inputManager?.detach();
    this.ctx = null;
    this.canvas = null;
    this.listeners.clear();
    if (this.persistHandle) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
  }

  dispatch(action: GameAction) {
    this.gameState = reduceState(this.gameState, action);
    this.rebuildBlueprintLookup();
    this.applyBlueprintPropertiesToState();
    this.refreshThingHashes();

    if (this.gameState.isPaused) {
      this.persistedGameState = this.capturePersistedState();
      this.schedulePersist();
    }

    this.notify();
  }

  getStateAtPath(path: SubscriptionPath) {
    switch (path[0]) {
      case "things": {
        if (path.length === 1) {
          return this.gameState.things;
        }
        const thing = this.gameState.things.find(
          (entry) => entry.id === path[1]
        );
        if (!thing) return undefined;
        if (path.length === 2) return thing;
        return (thing as Record<string, unknown>)[path[2]];
      }
      case "blueprints": {
        if (path.length === 1) {
          return this.gameState.blueprints;
        }
        const blueprint = this.gameState.blueprints.find(
          (entry) => normalizeName(entry.name) === normalizeName(path[1])
        );
        return blueprint;
      }
      case "camera":
        return this.gameState.camera;
      case "screen":
        return this.gameState.screen;
      case "isPaused":
        return this.gameState.isPaused;
      case "selectedThingId":
        return this.gameState.selectedThingId;
      case "selectedThingIds":
        return this.gameState.selectedThingIds;
      default:
        return undefined;
    }
  }

  subscribeStore = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getGameDirectory() {
    return this.gameDirectory;
  }

  private async loadGame() {
    const response = await fetch("/api/game");
    if (!response.ok) {
      throw new Error("Failed to load game");
    }
    const payload = (await response.json()) as LoadedGameResponse;
    this.gameDirectory = payload.gameDirectory;
    const blueprints = await this.loadBlueprints(
      payload.game.blueprints,
      this.gameDirectory
    );
    const blueprintMap = new Map(
      blueprints.map((bp) => [normalizeName(bp.name), bp])
    );
    const things = payload.game.things.map((thing) =>
      applyBlueprintProperties(structuredThingCopy(thing), blueprintMap)
    );

    this.gameState = {
      things,
      blueprints,
      camera: payload.game.camera,
      screen: payload.game.screen,
      isPaused: true,
      selectedThingId: null,
      selectedThingIds: [],
    };

    this.rebuildBlueprintLookup();
    this.refreshThingHashes();
    this.persistedGameState = this.capturePersistedState();
  }

  private async loadBlueprints(
    blueprintData: BlueprintData[],
    directory: string
  ) {
    const resolved: Blueprint[] = [];
    for (const data of blueprintData) {
      const slug = blueprintSlug(data.name);
      const blueprintModule = await import(
        /* webpackMode: "lazy" */ `@/games/${directory}/blueprints/${slug}.ts`
      );
      const blueprint = resolveBlueprintModule(blueprintModule, data);
      resolved.push(blueprint);
    }
    return resolved;
  }

  private startLoop() {
    if (this.frameHandle || typeof window === "undefined") {
      return;
    }

    const step = () => {
      this.tick();
      this.frameHandle = requestAnimationFrame(step);
    };

    this.frameHandle = requestAnimationFrame(step);
  }

  private tick() {
    if (!this.ready || !this.ctx) {
      return;
    }

    physicsStep(this.gameState.things, this.blueprintLookup);
    if (!this.gameState.isPaused) {
      this.handleInput();
      this.handleUpdates();
    }
    this.syncMutableThings();

    renderGame(
      { ctx: this.ctx, viewport: this.viewportSize },
      this.gameState,
      this.blueprintLookup
    );
    this.notify();
  }

  private handleInput() {
    if (!this.inputManager) return;
    for (const thing of this.gameState.things) {
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      blueprint?.input?.(thing, this.gameState, this.inputManager.keyState);
    }
  }

  private handleUpdates() {
    for (const thing of this.gameState.things) {
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      blueprint?.update?.(thing, this.gameState);
    }
  }

  private schedulePersist() {
    if (typeof window === "undefined") return;
    if (this.persistHandle) {
      clearTimeout(this.persistHandle);
    }
    this.persistHandle = window.setTimeout(() => {
      this.persistHandle = null;
      this.persistGame();
    }, 100);
  }

  private async persistGame() {
    if (!this.persistedGameState) {
      return;
    }
    try {
      await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameDirectory: this.gameDirectory,
          game: serializeGame(this.persistedGameState),
        }),
      });
    } catch (error) {
      console.warn("Failed to persist game", error);
    }
  }

  private capturePersistedState(): PersistedGameState {
    return {
      ...this.gameState,
      things: this.gameState.things.map(sanitizeThingForPersistence),
      blueprints: this.gameState.blueprints.map((bp) => ({
        name: bp.name,
        width: bp.width,
        height: bp.height,
        z: bp.z,
        color: bp.color,
      })),
    };
  }

  private notify() {
    const listeners = [...this.listeners];
    for (const listener of listeners) {
      listener();
    }
  }

  private resizeCanvas() {
    if (!this.canvas || !this.ctx || typeof window === "undefined") {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * scale;
    this.canvas.height = rect.height * scale;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.viewportSize = { width: rect.width, height: rect.height };
  }

  private rebuildBlueprintLookup() {
    this.blueprintLookup = new Map(
      this.gameState.blueprints.map((bp) => [normalizeName(bp.name), bp])
    );
  }

  private applyBlueprintPropertiesToState() {
    this.gameState = {
      ...this.gameState,
      things: this.gameState.things.map((thing) =>
        applyBlueprintProperties(thing, this.blueprintLookup)
      ),
    };
  }

  private refreshThingHashes() {
    this.thingHashes.clear();
    for (const thing of this.gameState.things) {
      this.thingHashes.set(thing.id, hashThing(thing));
    }
  }

  private syncMutableThings() {
    let nextThings: Thing[] | null = null;
    for (let i = 0; i < this.gameState.things.length; i += 1) {
      const thing = this.gameState.things[i];
      const hash = hashThing(thing);
      const previous = this.thingHashes.get(thing.id);
      if (hash !== previous) {
        if (!nextThings) {
          nextThings = [...this.gameState.things];
        }
        const copy = {
          ...thing,
          velocity: { ...thing.velocity },
        };
        nextThings[i] = copy;
        this.thingHashes.set(thing.id, hash);
      }
    }

    if (nextThings) {
      this.gameState = {
        ...this.gameState,
        things: nextThings.map((thing) =>
          applyBlueprintProperties(thing, this.blueprintLookup)
        ),
      };
    }
  }
}

function applyBlueprintProperties(
  thing: Thing,
  blueprintLookup: Map<string, Blueprint>
): Thing {
  const blueprint = getBlueprintForThing(thing, blueprintLookup);
  const inherits: Record<InheritableThingKeys, boolean> = {
    width: true,
    height: true,
    z: true,
    color: true,
    ...(thing.inherits ?? {}),
  };
  const next: Thing = {
    ...thing,
    inherits,
  };

  for (const key of INHERITABLE_PROPERTIES) {
    const thingValue = (thing as Record<string, unknown>)[key];
    const blueprintValue =
      blueprint && (blueprint as Record<string, unknown>)[key];
    if (inherits[key] !== false) {
      inherits[key] = true;
      if (blueprintValue !== undefined) {
        (next as Record<string, unknown>)[key] = blueprintValue;
      }
    } else if (thingValue !== undefined) {
      (next as Record<string, unknown>)[key] = thingValue;
    }
  }

  if (typeof next.width !== "number") {
    next.width = blueprint?.width ?? 0;
  }
  if (typeof next.height !== "number") {
    next.height = blueprint?.height ?? 0;
  }
  if (typeof next.color !== "string") {
    next.color = blueprint?.color ?? "#999";
  }
  if (typeof next.z !== "number") {
    next.z = blueprint?.z ?? 0;
  }

  return next;
}

function sanitizeThingForPersistence(thing: Thing): Thing {
  const persisted: Thing = {
    ...thing,
    inherits: undefined,
    velocity: { ...thing.velocity },
  };
  const target = persisted as Record<string, unknown>;
  for (const key of INHERITABLE_PROPERTIES) {
    if (thing.inherits?.[key]) {
      target[key] = undefined;
    }
  }
  return persisted;
}

function hashThing(thing: Thing) {
  return [
    thing.x,
    thing.y,
    thing.z,
    thing.width,
    thing.height,
    thing.angle,
    thing.velocity.x,
    thing.velocity.y,
    thing.physicsType,
    thing.color,
    thing.blueprintName,
  ].join("|");
}

function resolveBlueprintModule(
  module: Record<string, unknown>,
  data: BlueprintData
): Blueprint {
  const exported = module.default ?? module.blueprint ?? module;
  if (typeof exported === "function") {
    const functions = (exported as (bp: BlueprintData) => Partial<Blueprint>)(
      data
    );
    return { ...data, ...functions };
  }
  if (exported && typeof exported === "object") {
    if (
      "createBlueprint" in exported &&
      typeof exported.createBlueprint === "function"
    ) {
      const functions = exported.createBlueprint(data);
      return { ...data, ...functions };
    }
    return { ...data, ...(exported as Partial<Blueprint>) };
  }
  return { ...data };
}

function serializeGame(state: PersistedGameState): GameFile {
  return {
    things: state.things.map((thing) => ({
      ...thing,
      inherits: undefined,
    })),
    blueprints: state.blueprints,
    camera: state.camera,
    screen: state.screen,
  };
}
