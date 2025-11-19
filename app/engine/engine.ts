import { InputManager } from "./input";
import { physicsStep } from "./physics";
import { renderGame } from "./render";
import {
  Blueprint,
  BlueprintData,
  GameAction,
  GameFile,
  RuntimeGameState,
  PersistedGameState,
  RawGameState,
  RuntimeThing,
  SubscriptionPath,
  RawThing,
} from "./types";
import { blueprintSlug } from "@/lib/blueprints";
import { normalizeName, reduceState } from "./reducer";
import { getBlueprintForThing } from "./blueprints";
import { createThingProxy } from "./proxy";

type LoadedGameResponse = {
  game: GameFile;
  gameDirectory: string;
};

function cloneDefaultRawGameState(): RawGameState {
  return {
    things: [],
    blueprints: [],
    camera: { x: 0, y: 0 },
    screen: { width: 800, height: 600 },
    isPaused: false,
    selectedThingId: null,
    selectedThingIds: [],
  };
}

function cloneDefaultPersistedState(): PersistedGameState {
  const base = cloneDefaultRawGameState();
  return {
    ...base,
    blueprints: [],
    things: [],
  };
}

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameHandle: number | null = null;
  private resizeListener = () => this.resizeCanvas();
  private inputManager: InputManager | null = null;
  private listeners = new Set<() => void>();
  private rawGameState: RawGameState = cloneDefaultRawGameState();
  private gameState: RuntimeGameState = {
    ...this.rawGameState,
    things: [],
  };
  private persistedGameState: PersistedGameState = cloneDefaultPersistedState();
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
    this.ctx = canvas.getContext("2d", { desynchronized: true, alpha: false });

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
    this.rawGameState = reduceState(this.rawGameState, action);
    this.rebuildBlueprintLookup();
    this.updateRuntimeState();
    this.refreshThingHashes();

    if (this.rawGameState.isPaused) {
      this.persistedGameState = this.rawGameStateToPersistedGameState();
      this.schedulePersist();
    }

    this.notify();
    this.handleSideEffects(action);
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
    const things = payload.game.things.map((thing) =>
      normalizeThingFromFile(thing)
    );

    this.rawGameState = {
      things,
      blueprints,
      camera: payload.game.camera,
      screen: payload.game.screen,
      isPaused: false,
      selectedThingId: null,
      selectedThingIds: [],
    };

    this.rebuildBlueprintLookup();
    this.updateRuntimeState();
    this.refreshThingHashes();
    this.persistedGameState = this.rawGameStateToPersistedGameState();
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

    if (!this.gameState.isPaused) {
      physicsStep(this.gameState, this.blueprintLookup);
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
      blueprint?.update?.(thing, this.gameState, this.gameState.things);
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

  private rawGameStateToPersistedGameState(): PersistedGameState {
    return {
      things: this.rawGameState.things.map((thing) => ({ ...thing })),
      blueprints: this.rawGameState.blueprints.map((bp) => ({
        name: bp.name,
        width: bp.width,
        height: bp.height,
        z: bp.z,
        color: bp.color,
        shape: bp.shape,
        physicsType: bp.physicsType,
      })),
      camera: { ...this.rawGameState.camera },
      screen: { ...this.rawGameState.screen },
      isPaused: this.rawGameState.isPaused,
      selectedThingId: this.rawGameState.selectedThingId,
      selectedThingIds: [...this.rawGameState.selectedThingIds],
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
      this.rawGameState.blueprints.map((bp) => [normalizeName(bp.name), bp])
    );
  }

  private updateRuntimeState() {
    this.gameState = {
      ...this.rawGameState,
      things: this.rawGameState.things.map((thing) =>
        createThingProxy(thing, this.blueprintLookup)
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
    const runtimeThings = this.gameState.things;
    const rawThings = this.rawGameState.things;
    const runtimeIdSet = new Set(runtimeThings.map((thing) => thing.id));
    const rawIdSet = new Set(rawThings.map((thing) => thing.id));

    let nextRawThings: RawThing[] | null = null;

    const idsChanged =
      runtimeThings.length !== rawThings.length ||
      rawThings.some((thing) => !runtimeIdSet.has(thing.id)) ||
      runtimeThings.some((thing) => !rawIdSet.has(thing.id));

    if (idsChanged) {
      // When a blueprint update mutates the list (e.g. spawning bullets),
      // rebuild the raw array to keep indexes aligned with the current runtime
      // proxies; per-thing diffing would misalign if items were inserted.
      nextRawThings = runtimeThings.map(runtimeThingToThing);
    } else {
      for (let i = 0; i < runtimeThings.length; i += 1) {
        const runtimeThing = runtimeThings[i];
        const hash = hashThing(runtimeThing);
        const previous = this.thingHashes.get(runtimeThing.id);
        if (hash !== previous) {
          if (!nextRawThings) {
            nextRawThings = [...rawThings];
          }
          nextRawThings[i] = { ...(rawThings[i] ?? runtimeThing) };
          this.thingHashes.set(runtimeThing.id, hash);
        }
      }
    }

    if (nextRawThings) {
      const validIds = new Set(nextRawThings.map((thing) => thing.id));
      const nextSelectedThingIds = this.rawGameState.selectedThingIds.filter((id) =>
        validIds.has(id)
      );
      const hasPrimarySelection =
        this.rawGameState.selectedThingId &&
        validIds.has(this.rawGameState.selectedThingId);
      const nextSelectedThingId = hasPrimarySelection
        ? this.rawGameState.selectedThingId
        : nextSelectedThingIds[nextSelectedThingIds.length - 1] ?? null;

      this.rawGameState = {
        ...this.rawGameState,
        things: nextRawThings,
        selectedThingIds: nextSelectedThingIds,
        selectedThingId: nextSelectedThingId,
      };
      this.updateRuntimeState();
      this.refreshThingHashes();
      if (this.rawGameState.isPaused) {
        this.persistedGameState = this.rawGameStateToPersistedGameState();
        this.schedulePersist();
      }
    }
  }

  private handleSideEffects(action: GameAction) {
    switch (action.type) {
      case "addBlueprint": {
        const gameDirectory = this.requireGameDirectory();
        void fetch("/api/blueprints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameDirectory,
              blueprintName: action.blueprint.name,
            }),
          }).catch((error) => {
            console.warn("Failed to scaffold blueprint file", error);
          });
        break;
      }
      case "renameBlueprint": {
        const gameDirectory = this.requireGameDirectory();
        void fetch("/api/blueprints", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameDirectory,
              previousName: action.previousName,
              blueprintName: action.nextName,
            }),
          }).catch((error) => {
            console.warn("Failed to rename blueprint file", error);
          });
        break;
      }
      default:
        break;
    }
  }

  private requireGameDirectory() {
    if (!this.gameDirectory) {
      throw new Error("Game directory is not set");
    }
    return this.gameDirectory;
  }
}

function hashThing(thing: RuntimeThing) {
  return [
    thing.x,
    thing.y,
    thing.z,
    thing.width,
    thing.height,
    thing.angle,
    thing.velocityX,
    thing.velocityY,
    thing.physicsType,
    thing.color,
    thing.shape,
    thing.blueprintName,
  ].join("|");
}

function runtimeThingToThing(thing: RuntimeThing): RawThing {
  return {
    id: thing.id,
    x: thing.x,
    y: thing.y,
    z: thing.z,
    width: thing.width,
    height: thing.height,
    angle: thing.angle,
    velocityX: thing.velocityX,
    velocityY: thing.velocityY,
    physicsType: thing.physicsType,
    color: thing.color,
    blueprintName: thing.blueprintName,
    shape: thing.shape,
  };
}

function normalizeThingFromFile(thing: RawThing): RawThing {
  return {
    ...thing,
    velocityX: thing.velocityX ?? 0,
    velocityY: thing.velocityY ?? 0,
    physicsType: thing.physicsType ?? "dynamic",
  };
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
    things: state.things.map((thing) => ({ ...thing })),
    blueprints: state.blueprints,
    camera: state.camera,
    screen: state.screen,
  };
}
