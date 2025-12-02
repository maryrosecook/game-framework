import { InputManager } from "./input";
import { physicsStep } from "./physics";
import { renderGame } from "./render";
import {
  Blueprint,
  BlueprintData,
  CameraController,
  GameAction,
  GameFile,
  GameContext,
  RuntimeGameState,
  PersistedGameState,
  RawGameState,
  RuntimeThing,
  SubscriptionPath,
  RawThing,
  SpawnRequest,
  UpdateResult,
} from "./types";
import { blueprintSlug } from "@/lib/blueprints";
import { reduceState } from "./reducer";
import { getBlueprintForThing, createThingFromBlueprint } from "./blueprints";
import { createThingProxy } from "./proxy";
import { getBlueprintImageUrl } from "@/lib/images";
import { loadImages } from "./imageLoader";
import { CameraPauseReason, TimeWitnessDrive } from "./timeWitnessDrive";

export type LoadedGame = {
  game: GameFile;
  gameDirectory: string;
};

export type GameEngineDataSource = {
  loadGame: (gameDirectory: string) => Promise<LoadedGame>;
  persistGame: (gameDirectory: string, game: GameFile) => Promise<void>;
};

export type GameEngineSideEffects = {
  onBlueprintCreated?: (input: {
    gameDirectory: string;
    blueprintName: string;
  }) => Promise<void> | void;
  onBlueprintRenamed?: (input: {
    gameDirectory: string;
    previousName: string;
    nextName: string;
  }) => Promise<void> | void;
};

export type GameEngineDependencies = {
  dataSource: GameEngineDataSource;
  sideEffects?: GameEngineSideEffects;
  timeWitnessDrive?: TimeWitnessDrive;
};

const DEFAULT_BACKGROUND_COLOR = "#f8fafc";

function cloneDefaultRawGameState(): RawGameState {
  return {
    things: [],
    blueprints: [],
    camera: { x: 0, y: 0 },
    screen: { width: 800, height: 600 },
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
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
    image: null,
    things: [],
  };
}

export class GameEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private frameHandle: number | null = null;
  private resizeListener = () => this.resizeCanvas();
  private inputManager: InputManager | null = null;
  private inputAttached = false;
  private resizeAttached = false;
  private listeners = new Set<() => void>();
  private rawGameState: RawGameState = cloneDefaultRawGameState();
  private gameState: RuntimeGameState = {
    ...this.rawGameState,
    things: [],
  };
  private persistedGameState: PersistedGameState = cloneDefaultPersistedState();
  private isPersistedDirty = false;
  private cameraModule: CameraController | null = null;
  private gameDirectory = "";
  private viewportSize = { width: 0, height: 0 };
  private persistHandle: number | null = null;
  private ready = false;
  private blueprintLookup = new Map<string, Blueprint>();
  private thingHashes = new Map<string, string>();
  private blueprintImages = new Map<string, CanvasImageSource>();
  private blueprintImageLoadVersion = 0;
  private editingThingIds = new Set<string>();
  private cameraPauseReasons = new Set<CameraPauseReason>();

  constructor(private readonly dependencies: GameEngineDependencies) {}

  async initialize(canvas: HTMLCanvasElement, gameDirectory: string) {
    const isNewGame = this.gameDirectory !== gameDirectory;
    const isNewCanvas = this.canvas !== canvas;

    if (isNewGame) {
      this.ready = false;
      this.blueprintImages.clear();
      this.blueprintImageLoadVersion = 0;
      if (this.persistHandle) {
        clearTimeout(this.persistHandle);
        this.persistHandle = null;
      }
    }

    this.canvas = canvas;
    if (!this.ctx || isNewCanvas) {
      this.ctx = canvas.getContext("2d", {
        desynchronized: true,
        alpha: false,
      });
    }

    if (typeof window !== "undefined") {
      this.resizeCanvas();
      if (!this.resizeAttached) {
        window.addEventListener("resize", this.resizeListener);
        this.resizeAttached = true;
      }
      if (!this.inputManager) {
        this.inputManager = new InputManager();
      }
      if (!this.inputAttached) {
        this.inputManager.attach();
        this.inputAttached = true;
      }
    }

    if (isNewGame || !this.ready) {
      await this.loadGame(gameDirectory);
    }

    this.ready = true;
    this.startLoop();
    this.notify();
  }

  getBlueprint(name: string) {
    return this.blueprintLookup.get(name);
  }

  destroy() {
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    if (typeof window !== "undefined" && this.resizeAttached) {
      window.removeEventListener("resize", this.resizeListener);
      this.resizeAttached = false;
    }
    if (this.inputManager && this.inputAttached) {
      this.inputManager.detach();
      this.inputAttached = false;
    }
    this.ctx = null;
    this.canvas = null;
    this.rawGameState = cloneDefaultRawGameState();
    this.gameState = { ...this.rawGameState, things: [] };
    this.persistedGameState = cloneDefaultPersistedState();
    this.blueprintLookup.clear();
    this.thingHashes.clear();
    this.blueprintImages.clear();
    this.blueprintImageLoadVersion = 0;
    this.resetCameraPauses();
    this.editingThingIds.clear();
    this.isPersistedDirty = false;
    this.gameDirectory = "";
    this.listeners.clear();
    this.cameraModule = null;
    if (this.persistHandle) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
    this.ready = false;
  }

  dispatch(action: GameAction) {
    this.rawGameState = reduceState(this.rawGameState, action);
    this.rebuildBlueprintLookup();
    this.updateRuntimeState();
    this.refreshThingHashes();
    void this.syncBlueprintImages(this.rawGameState.blueprints);

    const persistedChanged = this.applyActionToPersistedState(action);
    if (persistedChanged) {
      this.isPersistedDirty = true;
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
          (entry) => entry.name === path[1]
        );
        return blueprint;
      }
      case "camera":
        return this.gameState.camera;
      case "screen":
        return this.gameState.screen;
      case "backgroundColor":
        return this.gameState.backgroundColor;
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

  beginEditingThings(ids: string[]) {
    const wasEditing = this.editingThingIds.size > 0;
    for (const id of ids) {
      this.editingThingIds.add(id);
      this.zeroThingVelocity(id);
    }
    if (!wasEditing && this.editingThingIds.size > 0) {
      this.pauseCamera("editing");
    }
  }

  endEditingThings(ids?: string[]) {
    if (!ids) {
      const hadEditing = this.editingThingIds.size > 0;
      this.editingThingIds.clear();
      if (hadEditing) {
        this.resumeCamera("editing");
      }
      return;
    }
    const wasEditing = this.editingThingIds.size > 0;
    for (const id of ids) {
      this.editingThingIds.delete(id);
    }
    if (wasEditing && this.editingThingIds.size === 0) {
      this.resumeCamera("editing");
    }
  }

  private pauseCamera(reason: CameraPauseReason) {
    const wasPaused = this.isCameraPaused();
    this.cameraPauseReasons.add(reason);
    if (!wasPaused) {
      this.dependencies.timeWitnessDrive?.pauseCamera(reason);
    }
  }

  private resumeCamera(reason: CameraPauseReason) {
    const removed = this.cameraPauseReasons.delete(reason);
    if (removed && !this.isCameraPaused()) {
      this.dependencies.timeWitnessDrive?.resumeCamera(reason);
    }
  }

  private resetCameraPauses() {
    if (this.cameraPauseReasons.size === 0) {
      return;
    }
    for (const reason of this.cameraPauseReasons) {
      this.dependencies.timeWitnessDrive?.resumeCamera(reason);
    }
    this.cameraPauseReasons.clear();
  }

  private isCameraPaused() {
    return this.cameraPauseReasons.size > 0;
  }

  private zeroThingVelocity(id: string) {
    const runtime = this.gameState.things.find((thing) => thing.id === id);
    if (runtime) {
      runtime.velocityX = 0;
      runtime.velocityY = 0;
    }
    const raw = this.rawGameState.things.find((thing) => thing.id === id);
    if (raw) {
      raw.velocityX = 0;
      raw.velocityY = 0;
    }
  }

  private async loadGame(gameDirectory: string) {
    const payload = await this.dependencies.dataSource.loadGame(gameDirectory);
    this.gameDirectory = payload.gameDirectory;
    this.persistedGameState = persistedStateFromGameFile(payload.game);
    this.isPersistedDirty = false;
    this.cameraModule = await this.loadCamera(this.gameDirectory);
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
      backgroundColor: this.persistedGameState.backgroundColor,
      isPaused: false,
      selectedThingId: null,
      selectedThingIds: [],
    };

    await this.syncBlueprintImages(this.rawGameState.blueprints);
    this.rebuildBlueprintLookup();
    this.updateRuntimeState();
    this.refreshThingHashes();
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

  private async loadCamera(directory: string) {
    try {
      const cameraModule = await import(
        /* webpackMode: "lazy" */ `@/games/${directory}/camera.ts`
      );
      return resolveCameraModule(cameraModule);
    } catch (error) {
      console.warn("Failed to load camera module", error);
      return null;
    }
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

    const pendingSpawns: RuntimeThing[] = [];
    const pendingRemovals = new Set<string>();
    const collidingThingIds = new Map<string, string[]>();
    const gameContext = this.createGameContext(
      collidingThingIds,
      pendingSpawns,
      pendingRemovals
    );

    physicsStep(
      this.gameState,
      this.blueprintLookup,
      gameContext,
      this.editingThingIds
    );
    this.handleInput(gameContext, pendingRemovals);
    this.handleUpdates(gameContext, pendingSpawns, pendingRemovals);
    this.applyPendingChanges(pendingSpawns, pendingRemovals);
    this.updateCameraPosition();
    this.syncMutableThings();

    renderGame(
      { ctx: this.ctx, viewport: this.viewportSize },
      gameContext,
      this.blueprintLookup,
      (thing, blueprint) => this.getImageForThing(thing, blueprint)
    );
    this.notify();
  }

  private handleInput(
    game: GameContext,
    pendingRemovals: Set<string>
  ) {
    if (!this.inputManager) return;
    for (const thing of this.gameState.things) {
      if (this.editingThingIds.has(thing.id)) continue;
      if (pendingRemovals.has(thing.id)) continue;
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      blueprint?.input?.(thing, game, this.inputManager.keyState);
    }
  }

  private handleUpdates(
    game: GameContext,
    pendingSpawns: RuntimeThing[],
    pendingRemovals: Set<string>
  ) {
    const thingsView = Object.freeze([...this.gameState.things]);

    for (const thing of thingsView) {
      if (this.editingThingIds.has(thing.id)) continue;
      if (pendingRemovals.has(thing.id)) continue;
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      const updateResult = blueprint?.update?.(thing, game);
      this.collectUpdateCommands(updateResult, pendingSpawns, pendingRemovals);
    }
  }

  private applyPendingChanges(
    pendingSpawns: RuntimeThing[],
    pendingRemovals: Set<string>
  ) {
    if (pendingRemovals.size === 0 && pendingSpawns.length === 0) {
      return;
    }

    const survivors = this.gameState.things.filter(
      (candidate) => !pendingRemovals.has(candidate.id)
    );
    const nextRuntimeThings = [...survivors, ...pendingSpawns];
    this.gameState = { ...this.gameState, things: nextRuntimeThings };
  }

  private createGameContext(
    collidingThingIds: Map<string, string[]>,
    pendingSpawns: RuntimeThing[],
    pendingRemovals: Set<string>
  ): GameContext {
    const spawn = (request: SpawnRequest) =>
      this.spawnFromRequest(request, pendingSpawns);
    const destroy = (target: RuntimeThing | string) => {
      const id = typeof target === "string" ? target : target.id;
      pendingRemovals.add(id);
    };

    const self = this;
    return {
      get gameState() {
        return self.gameState;
      },
      collidingThingIds,
      spawn,
      destroy,
    };
  }

  private updateCameraPosition() {
    if (!this.cameraModule || this.isCameraPaused()) {
      return;
    }
    const nextCamera = this.cameraModule.update(this.gameState);
    const current = this.gameState.camera;
    if (nextCamera.x === current.x && nextCamera.y === current.y) {
      return;
    }
    const camera = { x: nextCamera.x, y: nextCamera.y };
    this.gameState = { ...this.gameState, camera };
    this.rawGameState = { ...this.rawGameState, camera };
  }

  private collectUpdateCommands(
    result: UpdateResult | undefined,
    pendingSpawns: RuntimeThing[],
    pendingRemovals: Set<string>
  ) {
    if (!result) {
      return;
    }
    const commands = Array.isArray(result) ? result : [result];
    for (const command of commands) {
      switch (command.type) {
        case "spawn": {
          this.spawnFromRequest(command.request, pendingSpawns);
          break;
        }
        case "destroy": {
          pendingRemovals.add(command.id);
          break;
        }
        default:
          break;
      }
    }
  }

  private spawnFromRequest(
    request: SpawnRequest,
    pendingSpawns: RuntimeThing[]
  ): RuntimeThing | null {
    const blueprint = this.resolveBlueprintForSpawn(request);
    if (!blueprint) {
      return null;
    }
    const rawThing = createThingFromBlueprint(
      blueprint,
      request.position,
      request.overrides ?? {}
    );
    const runtimeThing = createThingProxy(rawThing, this.blueprintLookup);
    pendingSpawns.push(runtimeThing);
    return runtimeThing;
  }

  private resolveBlueprintForSpawn(request: SpawnRequest): Blueprint | null {
    if (typeof request.blueprint !== "string") {
      return request.blueprint;
    }
    return this.blueprintLookup.get(request.blueprint) ?? null;
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
    if (!this.persistedGameState || !this.isPersistedDirty) {
      return;
    }
    try {
      const gameDirectory = this.requireGameDirectory();
      await this.dependencies.dataSource.persistGame(
        gameDirectory,
        serializeGame(this.persistedGameState)
      );
      this.isPersistedDirty = false;
    } catch (error) {
      console.warn("Failed to persist game", error);
    }
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
      this.rawGameState.blueprints.map((bp) => [bp.name, bp])
    );
  }

  private getImageForThing(
    thing: RuntimeThing,
    blueprint?: Blueprint
  ): CanvasImageSource | null {
    const imageName = blueprint?.image;
    const src = getBlueprintImageUrl(this.gameDirectory, imageName);
    if (!src) {
      return null;
    }
    return this.blueprintImages.get(src) ?? null;
  }

  private sourcesForBlueprints(blueprints: Blueprint[]) {
    const sources = new Set<string>();
    for (const blueprint of blueprints) {
      const src = getBlueprintImageUrl(this.gameDirectory, blueprint.image);
      if (src) {
        sources.add(src);
      }
    }
    return sources;
  }

  private async syncBlueprintImages(nextBlueprints: Blueprint[]) {
    if (!this.gameDirectory) {
      return;
    }

    const nextSources = this.sourcesForBlueprints(nextBlueprints);
    const loadVersion = ++this.blueprintImageLoadVersion;

    for (const src of [...this.blueprintImages.keys()]) {
      if (!nextSources.has(src)) {
        this.blueprintImages.delete(src);
      }
    }

    const missingSources = [...nextSources].filter(
      (src) => !this.blueprintImages.has(src)
    );
    if (missingSources.length === 0) {
      return;
    }

    const loaded = await loadImages(missingSources);
    if (loadVersion !== this.blueprintImageLoadVersion) {
      return;
    }

    for (const [src, image] of loaded) {
      this.blueprintImages.set(src, image);
    }
    this.notify();
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
      const nextSelectedThingIds = this.rawGameState.selectedThingIds.filter(
        (id) => validIds.has(id)
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
    }
  }

  private applyActionToPersistedState(action: GameAction): boolean {
    switch (action.type) {
      case "setThingProperty":
        return this.updatePersistedThing(action.thingId, (thing) => ({
          ...thing,
          [action.property]: action.value,
        }));
      case "setThingProperties":
        return this.updatePersistedThing(action.thingId, (thing) => ({
          ...thing,
          ...action.properties,
        }));
      case "addThing": {
        this.persistedGameState = {
          ...this.persistedGameState,
          things: [...this.persistedGameState.things, { ...action.thing }],
        };
        return true;
      }
      case "removeThing": {
        const nextThings = this.persistedGameState.things.filter(
          (thing) => thing.id !== action.thingId
        );
        if (nextThings.length === this.persistedGameState.things.length) {
          return false;
        }
        this.persistedGameState = {
          ...this.persistedGameState,
          things: nextThings,
        };
        return true;
      }
      case "setBlueprintProperty":
        return this.updatePersistedBlueprint(
          action.blueprintName,
          (blueprint) => ({
            ...blueprint,
            [action.property]: action.value,
          })
        );
      case "setBlueprintProperties": {
        if (Object.keys(action.properties).length === 0) {
          return false;
        }
        return this.updatePersistedBlueprint(
          action.blueprintName,
          (blueprint) => ({
            ...blueprint,
            ...action.properties,
          })
        );
      }
      case "addBlueprint": {
        this.persistedGameState = {
          ...this.persistedGameState,
          blueprints: [
            ...this.persistedGameState.blueprints,
            blueprintToBlueprintData(action.blueprint),
          ],
        };
        return true;
      }
      case "removeBlueprint": {
        const nextBlueprints = this.persistedGameState.blueprints.filter(
          (bp) => bp.name !== action.blueprintName
        );
        const nextThings = this.persistedGameState.things.filter(
          (thing) => thing.blueprintName !== action.blueprintName
        );
        if (
          nextBlueprints.length === this.persistedGameState.blueprints.length &&
          nextThings.length === this.persistedGameState.things.length
        ) {
          return false;
        }
        this.persistedGameState = {
          ...this.persistedGameState,
          blueprints: nextBlueprints,
          things: nextThings,
        };
        return true;
      }
      case "renameBlueprint":
        return this.renamePersistedBlueprint(
          action.previousName,
          action.nextName
        );
      case "setCameraPosition": {
        this.persistedGameState = {
          ...this.persistedGameState,
          camera: { x: action.x, y: action.y },
        };
        return true;
      }
      case "setScreenSize": {
        this.persistedGameState = {
          ...this.persistedGameState,
          screen: { width: action.width, height: action.height },
        };
        return true;
      }
      case "setBackgroundColor": {
        if (this.persistedGameState.backgroundColor === action.color) {
          return false;
        }
        this.persistedGameState = {
          ...this.persistedGameState,
          backgroundColor: action.color,
        };
        return true;
      }
      default:
        return false;
    }
  }

  private updatePersistedThing(
    thingId: string,
    updater: (thing: RawThing) => RawThing
  ): boolean {
    const index = this.persistedGameState.things.findIndex(
      (candidate) => candidate.id === thingId
    );
    if (index < 0) {
      return false;
    }
    const nextThings = [...this.persistedGameState.things];
    const updated = updater({ ...nextThings[index] });
    nextThings[index] = updated;
    this.persistedGameState = {
      ...this.persistedGameState,
      things: nextThings,
    };
    return true;
  }

  private updatePersistedBlueprint(
    blueprintName: string,
    updater: (blueprint: BlueprintData) => BlueprintData
  ): boolean {
    const index = this.persistedGameState.blueprints.findIndex(
      (bp) => bp.name === blueprintName
    );
    if (index < 0) {
      return false;
    }
    const nextBlueprints = [...this.persistedGameState.blueprints];
    const updated = updater({ ...nextBlueprints[index] });
    nextBlueprints[index] = updated;
    this.persistedGameState = {
      ...this.persistedGameState,
      blueprints: nextBlueprints,
    };
    return true;
  }

  private renamePersistedBlueprint(
    previousName: string,
    nextName: string
  ): boolean {
    const index = this.persistedGameState.blueprints.findIndex(
      (bp) => bp.name === previousName
    );
    if (index < 0) {
      return false;
    }
    const nextBlueprints = [...this.persistedGameState.blueprints];
    nextBlueprints[index] = { ...nextBlueprints[index], name: nextName };
    const nextThings = this.persistedGameState.things.map((thing) =>
      thing.blueprintName === previousName
        ? { ...thing, blueprintName: nextName }
        : thing
    );
    this.persistedGameState = {
      ...this.persistedGameState,
      blueprints: nextBlueprints,
      things: nextThings,
    };
    return true;
  }

  private handleSideEffects(action: GameAction) {
    const sideEffects = this.dependencies.sideEffects;
    if (!sideEffects) {
      return;
    }
    switch (action.type) {
      case "addBlueprint": {
        const gameDirectory = this.requireGameDirectory();
        void Promise.resolve(
          sideEffects.onBlueprintCreated?.({
            gameDirectory,
            blueprintName: action.blueprint.name,
          })
        ).catch((error) => {
          console.warn("Failed to run blueprint add side effect", error);
        });
        break;
      }
      case "renameBlueprint": {
        const gameDirectory = this.requireGameDirectory();
        void Promise.resolve(
          sideEffects.onBlueprintRenamed?.({
            gameDirectory,
            previousName: action.previousName,
            nextName: action.nextName,
          })
        ).catch((error) => {
          console.warn("Failed to run blueprint rename side effect", error);
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

function persistedStateFromGameFile(game: GameFile): PersistedGameState {
  const fallbackClear = (game as { clearColor?: string }).clearColor;
  const backgroundColor =
    typeof game.backgroundColor === "string" &&
    game.backgroundColor.trim().length > 0
      ? game.backgroundColor
      : typeof fallbackClear === "string" && fallbackClear.trim().length > 0
        ? fallbackClear
        : DEFAULT_BACKGROUND_COLOR;
  return {
    things: game.things.map((thing) => normalizeThingFromFile({ ...thing })),
    blueprints: game.blueprints.map((blueprint) => ({ ...blueprint })),
    camera: { ...game.camera },
    screen: { ...game.screen },
    backgroundColor,
    image: game.image ?? null,
    isPaused: false,
    selectedThingId: null,
    selectedThingIds: [],
  };
}

function blueprintToBlueprintData(
  entry: Blueprint | BlueprintData
): BlueprintData {
  return {
    name: entry.name,
    width: entry.width,
    height: entry.height,
    z: entry.z,
    color: entry.color,
    image: entry.image,
    shape: entry.shape,
    physicsType: entry.physicsType,
  };
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
    thing.shape,
    thing.blueprintName,
    JSON.stringify(thing.data),
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
    blueprintName: thing.blueprintName,
    shape: thing.shape,
    data: thing.data,
  };
}

function normalizeThingFromFile(
  thing: RawThing & { image?: unknown }
): RawThing {
  // Drop any per-thing image overrides; images belong to blueprints.
  const { image: _ignored, ...rest } = thing;
  return {
    ...rest,
    velocityX: rest.velocityX ?? 0,
    velocityY: rest.velocityY ?? 0,
  };
}

function resolveBlueprintModule(
  moduleExports: Record<string, unknown>,
  data: BlueprintData
): Blueprint {
  const exported =
    moduleExports.default ?? moduleExports.blueprint ?? moduleExports;
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

function resolveCameraModule(
  moduleExports: Record<string, unknown>
): CameraController | null {
  const exported =
    (moduleExports as { default?: unknown }).default ?? moduleExports;
  if (typeof exported === "function") {
    return { update: exported as CameraController["update"] };
  }
  if (
    exported &&
    typeof exported === "object" &&
    "update" in exported &&
    typeof (exported as Record<string, unknown>).update === "function"
  ) {
    const { update } = exported as { update: CameraController["update"] };
    return { update };
  }
  return null;
}

function serializeGame(state: PersistedGameState): GameFile {
  return {
    things: state.things.map((thing) => ({ ...thing })),
    blueprints: state.blueprints,
    camera: state.camera,
    screen: state.screen,
    backgroundColor: state.backgroundColor,
    image: state.image ?? null,
  };
}
