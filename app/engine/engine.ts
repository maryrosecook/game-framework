import { InputManager, PointerInputEvent } from "./input";
import { physicsStep } from "./physics";
import { renderGame } from "./render";
import type { PaintOverlay } from "./render";
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
  PersistedThing,
  SpawnRequest,
  Vector,
} from "./types";
import { blueprintSlug } from "@/lib/blueprints";
import { reduceState } from "./reducer";
import {
  createThingFromBlueprint,
  getBlueprintForThing,
  normalizeBlueprintData,
  runBlueprintHandlers,
  sanitizeThingData,
} from "./blueprints";
import { createThingProxy } from "./proxy";
import { getBlueprintImageUrl } from "@/lib/images";
import { loadImages } from "./imageLoader";
import {
  DEFAULT_IMAGE_SIZE,
  EditableImageRecord,
  extractFileName,
  EditableImageStore,
} from "./editableImages";
import { CameraPauseReason, TimeWitnessDrive } from "./timeWitnessDrive";
import {
  createPointerInterpreter,
  findTopThingAtPoint,
  getWorldPointFromClient as getPointerWorldPointFromClient,
} from "./input/pointer";
import {
  PointerInteractionContext,
  PointerMode,
} from "./input/pointer/types";
import { createThingId } from "@/lib/id";

const DUPLICATE_WORLD_OFFSET = 20;

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

type BlueprintJsModule = Record<string, unknown>;
type BlueprintJsModuleMap = Record<string, BlueprintJsModule>;

// A module that contains per-blueprint modules.
type BlueprintJsModuleManifestJsModule = {
  blueprints: BlueprintJsModuleMap;
  manifestVersion?: string;
};

type BlueprintJsModuleManifest = {
  modules: BlueprintJsModuleMap;
  version: string | null;
};

const DEFAULT_BACKGROUND_COLOR = "#f8fafc";

function cloneDefaultRawGameState(): RawGameState {
  return {
    things: [],
    blueprints: [],
    camera: { x: 0, y: 0 },
    screen: { width: 800, height: 600 },
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    isGravityEnabled: false,
    isPaused: false,
    selectedThingId: null,
    selectedThingIds: [],
  };
}

function cloneDefaultPersistedState(): PersistedGameState {
  const base = cloneDefaultRawGameState();
  return {
    id: -1,
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
  private imagePersistListeners = new Set<
    (payload: { src: string; fileName: string }) => void
  >();
  private editableImageStore = new EditableImageStore((record) =>
    this.notifyImagePersistListeners(record)
  );
  private pointerMode: PointerMode = "pointer";
  private paintColor = "#000000";
  private paintHover: {
    thingId: string;
    pixel: { x: number; y: number };
  } | null = null;
  private editingThingIds = new Set<string>();
  private cameraPauseReasons = new Set<CameraPauseReason>();
  private pointerInterpreter = createPointerInterpreter();
  private blueprintManifestVersion: string | null = null;
  private createdThingIds = new Set<string>();

  constructor(private readonly dependencies: GameEngineDependencies) {}

  async initialize(canvas: HTMLCanvasElement, gameDirectory: string) {
    const isNewGame = this.gameDirectory !== gameDirectory;
    const isNewCanvas = this.canvas !== canvas;

    if (isNewGame) {
      this.ready = false;
      this.blueprintImages.clear();
      this.blueprintImageLoadVersion = 0;
      this.editableImageStore.reset();
      this.pointerMode = "pointer";
      this.paintColor = "#000000";
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
      this.inputManager.attach();
      this.inputManager.bindPointerTarget(canvas);
      this.inputAttached = true;
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

  async hotReloadBlueprints(manifestVersion?: string | null) {
    if (!this.gameDirectory) {
      return;
    }

    const requestedVersion = manifestVersion ?? null;
    if (
      requestedVersion !== null &&
      requestedVersion === this.blueprintManifestVersion
    ) {
      return;
    }

    const { blueprints, manifestVersion: detectedVersion } =
      await this.loadBlueprintsWithManifestVersion(
        this.persistedGameState.blueprints,
        this.gameDirectory
      );

    const nextVersion = requestedVersion ?? detectedVersion ?? null;
    if (nextVersion !== null && nextVersion === this.blueprintManifestVersion) {
      return;
    }

    this.rawGameState = { ...this.rawGameState, blueprints };
    await this.syncBlueprintImages(this.rawGameState.blueprints);
    this.rebuildBlueprintLookup();
    this.updateRuntimeState();
    this.refreshThingHashes();
    this.blueprintManifestVersion = nextVersion;
    this.notify();
  }

  setPointerMode(mode: PointerMode) {
    this.pointerMode = mode;
  }

  getPointerMode() {
    return this.pointerMode;
  }

  setPaintColor(color: string) {
    this.paintColor = color;
  }

  getPaintColor() {
    return this.paintColor;
  }

  duplicateThingsWithIds(selectedIds: string[], worldPoint: Vector): string[] {
    const duplicates = this.duplicateSelection(selectedIds, worldPoint);
    if (duplicates.length === 0) {
      return [];
    }
    return duplicates.map((duplicate) => duplicate.id);
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
    this.editableImageStore.reset();
    this.imagePersistListeners.clear();
    this.resetCameraPauses();
    this.editingThingIds.clear();
    this.pointerInterpreter.reset();
    this.createdThingIds.clear();
    this.blueprintManifestVersion = null;
    this.isPersistedDirty = false;
    this.gameDirectory = "";
    this.listeners.clear();
    this.cameraModule = null;
    if (this.persistHandle) {
      clearTimeout(this.persistHandle);
      this.persistHandle = null;
    }
    this.pointerMode = "pointer";
    this.paintColor = "#000000";
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
        if (isThingPropertyPath(path)) {
          const key = path[2];
          return thing[key];
        }
        return undefined;
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
      case "isGravityEnabled":
        return this.gameState.isGravityEnabled;
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

  subscribeImageUpdates(
    listener: (payload: { src: string; fileName: string }) => void
  ) {
    this.imagePersistListeners.add(listener);
    return () => {
      this.imagePersistListeners.delete(listener);
    };
  }

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
    this.createdThingIds.clear();
    this.persistedGameState = persistedStateFromGameFile(payload.game);
    this.isPersistedDirty = false;
    this.cameraModule = await this.loadCamera(this.gameDirectory);
    const { blueprints, manifestVersion: blueprintManifestVersion } =
      await this.loadBlueprintsWithManifestVersion(
        payload.game.blueprints,
        this.gameDirectory
      );
    const things = payload.game.things.map((thing) => ({
      ...stripThingData(normalizeThingFromFile(thing)),
      isGrounded: false,
    }));

    this.rawGameState = {
      things,
      blueprints,
      camera: payload.game.camera,
      screen: payload.game.screen,
      backgroundColor: this.persistedGameState.backgroundColor,
      isGravityEnabled: this.persistedGameState.isGravityEnabled,
      isPaused: false,
      selectedThingId: null,
      selectedThingIds: [],
    };

    await this.syncBlueprintImages(this.rawGameState.blueprints);
    this.rebuildBlueprintLookup();
    this.updateRuntimeState();
    this.refreshThingHashes();
    this.blueprintManifestVersion = blueprintManifestVersion;
  }

  private async loadBlueprintsWithManifestVersion(
    blueprintData: BlueprintData[],
    directory: string
  ): Promise<{ blueprints: Blueprint[]; manifestVersion: string | null }> {
    const manifest = await this.loadBlueprintJsModuleManifest(directory);
    const blueprints = await this.importBlueprints(
      blueprintData,
      directory,
      manifest?.modules ?? null
    );
    return { blueprints, manifestVersion: manifest?.version ?? null };
  }

  private async importBlueprints(
    blueprintData: BlueprintData[],
    directory: string,
    manifestModules: BlueprintJsModuleMap | null
  ): Promise<Blueprint[]> {
    const blueprints: Blueprint[] = [];
    for (const data of blueprintData) {
      const slug = blueprintSlug(data.name);
      const blueprintJsModule =
        manifestModules?.[slug] ??
        (await this.importBlueprintJsModule(directory, slug));
      const blueprint = resolveBlueprintModule(blueprintJsModule, data);
      const normalized = normalizeBlueprintData(blueprint);
      blueprints.push(normalized);
    }
    return blueprints;
  }

  private async importBlueprintJsModule(
    directory: string,
    slug: string
  ): Promise<BlueprintJsModule> {
    const moduleExports: BlueprintJsModule = await import(
      /* webpackMode: "lazy" */ `@/games/${directory}/blueprints/${slug}.ts`
    );
    return moduleExports;
  }

  private async loadBlueprintJsModuleManifest(
    directory: string
  ): Promise<BlueprintJsModuleManifest | null> {
    try {
      const manifestModule: BlueprintJsModuleManifestJsModule = await import(
        /* webpackMode: "eager" */ `@/games/${directory}/blueprint-manifest`
      );

      if (isBlueprintManifestModule(manifestModule)) {
        return {
          modules: manifestModule.blueprints,
          version: manifestModule.manifestVersion ?? null,
        } satisfies BlueprintJsModuleManifest;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `Blueprint manifest not available for "${directory}", falling back to dynamic imports.`,
          error
        );
      }
    }

    return null;
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

    this.processPointerEvents();

    const pendingSpawns: RuntimeThing[] = [];
    const pendingRemovals = new Set<string>();
    const collidingThingIds = new Map<string, string[]>();
    const gameContext = this.createGameContext(
      collidingThingIds,
      pendingSpawns,
      pendingRemovals
    );

    this.runCreateHandlers(gameContext);

    physicsStep(
      this.gameState,
      this.blueprintLookup,
      gameContext,
      this.editingThingIds
    );
    this.runInputHandlers(gameContext, pendingRemovals);
    this.runUpdateHandlers(gameContext, pendingRemovals);
    this.applyPendingChanges(pendingSpawns, pendingRemovals);
    this.runCreateHandlers(gameContext);
    this.updateCameraPosition();
    this.syncMutableThings();

    renderGame(
      { ctx: this.ctx, viewport: this.viewportSize },
      gameContext,
      this.blueprintLookup,
      (thing, blueprint) => this.getImageForThing(thing, blueprint),
      this.buildPaintOverlay()
    );
    this.notify();
  }

  private processPointerEvents() {
    if (!this.inputManager) return;
    const events = this.inputManager.consumePointerEvents();
    if (events.length === 0) {
      return;
    }

    const context = this.createPointerInteractionContext();
    this.processPaintHover(events, context);
    this.pointerInterpreter.process(events, () => this.gameState, context);
  }

  private processPaintHover(
    events: PointerInputEvent[],
    context: PointerInteractionContext
  ) {
    if (this.pointerMode !== "paint") {
      this.paintHover = null;
      return;
    }

    const selectedId = this.gameState.selectedThingId;
    for (const event of events) {
      if (event.type === "move") {
        const worldPoint = context.getWorldPoint(event.clientX, event.clientY);
        if (!worldPoint || !selectedId) {
          this.paintHover = null;
          continue;
        }
        const hit = context.hitTest(worldPoint);
        if (!hit || hit.id !== selectedId) {
          this.paintHover = null;
          continue;
        }
        const pixel = this.worldPointToPixel(worldPoint, hit);
        if (!pixel) {
          this.paintHover = null;
          continue;
        }
        this.paintHover = { thingId: hit.id, pixel };
      } else if (event.type === "leave" || event.type === "cancel") {
        this.paintHover = null;
      }
    }
  }

  private createPointerInteractionContext(): PointerInteractionContext {
    return {
      dispatch: (action) => this.dispatch(action),
      beginEditing: (ids) => this.beginEditingThings(ids),
      endEditing: (ids) => this.endEditingThings(ids),
      hitTest: (worldPoint) => this.hitTestThing(worldPoint),
      duplicateSelection: (selectedIds, worldPoint) =>
        this.duplicateSelection(selectedIds, worldPoint),
      getWorldPoint: (clientX, clientY) =>
        this.getWorldPointFromClient(clientX, clientY),
      capturePointer: (pointerId) =>
        this.inputManager?.capturePointer(pointerId),
      releasePointer: (pointerId) =>
        this.inputManager?.releasePointerCapture(pointerId),
      pointerMode: this.pointerMode,
      paintColor: this.paintColor,
      paintAt: (thing, worldPoint, previousWorldPoint) =>
        this.paintAt(thing, worldPoint, previousWorldPoint),
    };
  }

  private getWorldPointFromClient(
    clientX: number,
    clientY: number
  ): Vector | null {
    return getPointerWorldPointFromClient({
      canvas: this.canvas,
      clientX,
      clientY,
      screen: this.gameState.screen,
      camera: this.gameState.camera,
    });
  }

  private hitTestThing(worldPoint: Vector) {
    return findTopThingAtPoint(
      worldPoint,
      this.gameState.things,
      this.blueprintLookup
    );
  }

  private duplicateSelection(
    selectedIds: string[],
    worldPoint: Vector
  ): RuntimeThing[] {
    const thingLookup = new Map(
      this.gameState.things.map((thing) => [thing.id, thing])
    );
    const duplicates: RuntimeThing[] = [];
    const duplicateWorldPoint = {
      x: worldPoint.x + DUPLICATE_WORLD_OFFSET,
      y: worldPoint.y + DUPLICATE_WORLD_OFFSET,
    };

    for (const id of selectedIds) {
      const original = thingLookup.get(id);
      if (!original) continue;
      const offsetX = worldPoint.x - original.x;
      const offsetY = worldPoint.y - original.y;
      const clone: RuntimeThing = {
        ...original,
        id: createThingId(),
        velocityX: 0,
        velocityY: 0,
        x: duplicateWorldPoint.x - offsetX,
        y: duplicateWorldPoint.y - offsetY,
      };
      duplicates.push(clone);
    }

    if (duplicates.length === 0) {
      return [];
    }

    for (const duplicate of duplicates) {
      this.dispatch({ type: "addThing", thing: duplicate });
    }

    return duplicates;
  }

  private paintAt(
    thing: RuntimeThing,
    worldPoint: Vector,
    previousWorldPoint?: Vector | null
  ) {
    const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
    if (!blueprint) {
      return;
    }

    const record = this.ensureEditableImageForBlueprint(blueprint);
    if (!record) {
      return;
    }

    const canvas = record.canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    ctx.imageSmoothingEnabled = false;

    const currentPixel = this.worldPointToPixel(worldPoint, thing);
    if (!currentPixel) {
      return;
    }

    const previousPixel = previousWorldPoint
      ? this.worldPointToPixel(previousWorldPoint, thing)
      : null;

    if (previousPixel) {
      this.drawLine(ctx, previousPixel, currentPixel, this.paintColor);
    } else {
      this.drawPixel(ctx, currentPixel, this.paintColor);
    }

    this.markImageDirty(record);
  }

  private ensureEditableImageForBlueprint(
    blueprint: Blueprint
  ): EditableImageRecord | null {
    const existingSrc = getBlueprintImageUrl(
      this.gameDirectory,
      blueprint.image
    );

    // Case 1: Blueprint already references an image. Wrap it in a 16x16 canvas so we can paint directly.
    if (existingSrc) {
      const record = this.getOrCreateImageRecord(existingSrc);
      if (record) return record;
      return null;
    }

    // Case 2: Blueprint has no image yet. Create a new 16x16 blank, wire it up, and assign it to the blueprint.
    if (!this.gameDirectory) {
      return null;
    }

    const fileName = `${blueprintSlug(blueprint.name)}-paint-${Date.now()}.png`;
    const src = getBlueprintImageUrl(this.gameDirectory, fileName);
    if (!src) {
      return null;
    }

    const record = this.editableImageStore.createBlank(src, fileName);
    if (!record) {
      return null;
    }

    this.blueprintImages.set(src, record.canvas);

    this.dispatch({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "image",
      value: fileName,
    });

    this.markImageDirty(record);
    return record;
  }

  private getOrCreateImageRecord(src: string): EditableImageRecord | null {
    // If we've already materialized a paintable record for this src, reuse it.
    const existing = this.editableImageStore.getRecord(src);
    if (existing) {
      return existing;
    }

    // Otherwise, try to wrap the currently loaded image into a 16x16 canvas so we can mutate it.
    const source = this.blueprintImages.get(src);
    if (!source) {
      return null;
    }

    const fileName = extractFileName(src);
    if (!fileName) {
      return null;
    }

    const record = this.editableImageStore.wrapSource(src, fileName, source);
    if (!record) {
      return null;
    }

    this.blueprintImages.set(src, record.canvas);
    return record;
  }

  private worldPointToPixel(worldPoint: Vector, thing: RuntimeThing) {
    const size = { width: DEFAULT_IMAGE_SIZE, height: DEFAULT_IMAGE_SIZE };

    const localX = (worldPoint.x - thing.x) / thing.width;
    const localY = (worldPoint.y - thing.y) / thing.height;
    if (localX < 0 || localX > 1 || localY < 0 || localY > 1) {
      return null;
    }

    const pixelX = Math.floor(localX * size.width);
    const pixelY = Math.floor(localY * size.height);

    const clampedX = Math.min(size.width - 1, Math.max(0, pixelX));
    const clampedY = Math.min(size.height - 1, Math.max(0, pixelY));

    return { x: clampedX, y: clampedY };
  }

  private drawPixel(
    ctx: CanvasRenderingContext2D,
    pixel: { x: number; y: number },
    color: string
  ) {
    ctx.fillStyle = color;
    ctx.fillRect(pixel.x, pixel.y, 1, 1);
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number },
    color: string
  ) {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const steps = Math.max(dx, dy);

    if (steps === 0) {
      this.drawPixel(ctx, start, color);
      return;
    }

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = Math.round(start.x + (end.x - start.x) * t);
      const y = Math.round(start.y + (end.y - start.y) * t);
      this.drawPixel(ctx, { x, y }, color);
    }
  }

  private markImageDirty(record: EditableImageRecord) {
    this.editableImageStore.markDirty(record);
  }

  private notifyImagePersistListeners(record: EditableImageRecord) {
    if (this.imagePersistListeners.size === 0) {
      return;
    }
    const payload = { src: record.src, fileName: record.fileName };
    for (const listener of this.imagePersistListeners) {
      listener(payload);
    }
  }

  private buildPaintOverlay(): PaintOverlay | undefined {
    if (this.pointerMode !== "paint") {
      return undefined;
    }
    const selectedThingId = this.gameState.selectedThingId ?? null;
    return {
      selectedThingId,
      hoverPixel:
        this.paintHover && this.paintHover.thingId === selectedThingId
          ? this.paintHover.pixel
          : null,
      color: this.paintColor,
      gridColor: "rgba(120,120,120,0.8)",
    };
  }

  private runInputHandlers(game: GameContext, pendingRemovals: Set<string>) {
    if (!this.inputManager) return;
    const keyState = this.inputManager.keyState;
    for (const thing of this.gameState.things) {
      if (this.editingThingIds.has(thing.id)) continue;
      if (pendingRemovals.has(thing.id)) continue;
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      runBlueprintHandlers("input", blueprint, blueprint?.input, (handler) =>
        handler(thing, game, keyState)
      );
    }
  }

  private runUpdateHandlers(game: GameContext, pendingRemovals: Set<string>) {
    const thingsView = Object.freeze([...this.gameState.things]);

    for (const thing of thingsView) {
      if (this.editingThingIds.has(thing.id)) continue;
      if (pendingRemovals.has(thing.id)) continue;
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      runBlueprintHandlers("update", blueprint, blueprint?.update, (handler) =>
        handler(thing, game)
      );
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
    const self = this;
    const spawn = (request: SpawnRequest) =>
      this.spawnFromRequest(request, pendingSpawns);
    const destroy = (target: RuntimeThing | string) => {
      const id = typeof target === "string" ? target : target.id;
      pendingRemovals.add(id);
    };
    const getImageForThing = (thing: RuntimeThing) => {
      const blueprint = getBlueprintForThing(thing, self.blueprintLookup);
      return self.getImageForThing(thing, blueprint);
    };

    return {
      get gameState() {
        return self.gameState;
      },
      collidingThingIds,
      spawn,
      destroy,
      getImageForThing,
    };
  }

  private runCreateHandlers(game: GameContext) {
    for (const thing of this.gameState.things) {
      if (this.createdThingIds.has(thing.id)) {
        continue;
      }
      const blueprint = getBlueprintForThing(thing, this.blueprintLookup);
      runBlueprintHandlers("create", blueprint, blueprint?.create, (handler) =>
        handler(thing, game)
      );
      this.createdThingIds.add(thing.id);
    }
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
        this.editableImageStore.remove(src);
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
      const fileName = extractFileName(src);
      const record = fileName
        ? this.editableImageStore.wrapSource(src, fileName, image)
        : null;
      if (record) {
        this.blueprintImages.set(src, record.canvas);
      } else {
        this.blueprintImages.set(src, image);
      }
    }
    this.notify();
  }

  private updateRuntimeState() {
    let rawThingsChanged = false;
    const sanitizedThings = this.rawGameState.things.map((thing) => {
      const sanitized = sanitizeThingData(thing, this.blueprintLookup);
      if (sanitized !== thing) {
        rawThingsChanged = true;
      }
      return sanitized;
    });

    if (rawThingsChanged) {
      this.rawGameState = { ...this.rawGameState, things: sanitizedThings };
    }

    this.gameState = {
      ...this.rawGameState,
      things: sanitizedThings.map((thing) =>
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
        return this.updatePersistedThing(action.thingId, (thing) =>
          stripThingData({
            ...thing,
            [action.property]: action.value,
          })
        );
      case "setThingProperties":
        return this.updatePersistedThing(action.thingId, (thing) =>
          stripThingData({
            ...thing,
            ...action.properties,
          })
        );
      case "addThing": {
        this.persistedGameState = {
          ...this.persistedGameState,
          things: [
            ...this.persistedGameState.things,
            stripThingData({ ...action.thing }),
          ],
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
      case "setGravityEnabled": {
        if (
          this.persistedGameState.isGravityEnabled === action.isGravityEnabled
        ) {
          return false;
        }
        this.persistedGameState = {
          ...this.persistedGameState,
          isGravityEnabled: action.isGravityEnabled,
        };
        return true;
      }
      default:
        return false;
    }
  }

  private updatePersistedThing(
    thingId: string,
    updater: (thing: PersistedThing) => PersistedThing
  ): boolean {
    const index = this.persistedGameState.things.findIndex(
      (candidate) => candidate.id === thingId
    );
    if (index < 0) {
      return false;
    }
    const nextThings = [...this.persistedGameState.things];
    const updated = updater({ ...nextThings[index] });
    nextThings[index] = stripThingData({
      ...updated,
      isGrounded: false,
      data: undefined,
    });
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
    nextBlueprints[index] = { ...updated };
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
        ? stripThingData({ ...thing, blueprintName: nextName })
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

function isThingPropertyPath(
  path: SubscriptionPath
): path is ["things", string, keyof RuntimeThing] {
  return path[0] === "things" && path.length === 3;
}

function persistedStateFromGameFile(game: GameFile): PersistedGameState {
  const fallbackClear = game.clearColor;
  const backgroundColor =
    typeof game.backgroundColor === "string" &&
    game.backgroundColor.trim().length > 0
      ? game.backgroundColor
      : typeof fallbackClear === "string" && fallbackClear.trim().length > 0
      ? fallbackClear
      : DEFAULT_BACKGROUND_COLOR;
  return {
    id: game.id,
    things: game.things.map((thing) =>
      stripThingData(normalizeThingFromFile({ ...thing }))
    ),
    blueprints: game.blueprints.map((blueprint) => ({ ...blueprint })),
    camera: { ...game.camera },
    screen: { ...game.screen },
    backgroundColor,
    isGravityEnabled: !!game.isGravityEnabled,
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
    behaviors: entry.behaviors,
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
    thing.isGrounded,
    thing.physicsType,
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
    isGrounded: thing.isGrounded,
    blueprintName: thing.blueprintName,
    data: thing.data,
  };
}

function normalizeThingFromFile(
  thing: PersistedThing & { image?: unknown }
): RawThing {
  // Drop any per-thing image overrides; images belong to blueprints.
  const { image: _ignored, ...rest } = thing;
  return {
    ...rest,
    velocityX: rest.velocityX ?? 0,
    velocityY: rest.velocityY ?? 0,
    isGrounded: false,
  };
}

function stripThingData<TData>(
  thing: PersistedThing | RawThing<TData>
): PersistedThing {
  const withDefaults: PersistedThing & {
    data?: TData;
    isGrounded?: boolean;
  } = { isGrounded: false, data: undefined, ...thing };
  const {
    data: _ignored,
    isGrounded: _ignoredGrounded,
    ...rest
  } = withDefaults;
  return { ...rest };
}

function isBlueprintManifestModule(
  value: unknown
): value is BlueprintJsModuleManifestJsModule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const manifest = (value as { blueprints?: unknown }).blueprints;

  if (!manifest || typeof manifest !== "object") {
    return false;
  }

  return Object.values(manifest as Record<string, unknown>).every((module) =>
    isBlueprintJsModule(module)
  );
}

function isBlueprintJsModule(value: unknown): value is BlueprintJsModule {
  const factory = (value as { default?: unknown })?.default;
  return typeof factory === "function";
}

function resolveBlueprintModule(
  moduleExports: BlueprintJsModule,
  data: BlueprintData
): Blueprint {
  const factory = moduleExports.default;

  if (!isBlueprintFactory(factory)) {
    return { ...data };
  }

  const blueprint = factory(data);
  if (!isBlueprintLike(blueprint)) {
    throw new Error(
      `Blueprint factory for "${data.name}" must return an object with blueprint properties.`
    );
  }

  return { ...data, ...blueprint };
}

function resolveCameraModule(
  moduleExports: Record<string, unknown>
): CameraController | null {
  const update = moduleExports.default;

  if (!isCameraUpdate(update)) {
    console.warn(
      "Camera module must default export a function that updates the camera position."
    );
    return null;
  }

  return { update };
}

function serializeGame(state: PersistedGameState): GameFile {
  return {
    id: state.id,
    things: state.things.map((thing) => ({ ...thing })),
    blueprints: state.blueprints.map((bp) => ({ ...bp })),
    camera: state.camera,
    screen: state.screen,
    backgroundColor: state.backgroundColor,
    isGravityEnabled: state.isGravityEnabled,
    image: state.image ?? null,
  };
}

type BlueprintFactory = (bp: BlueprintData) => Partial<Blueprint> | Blueprint;

function isBlueprintFactory(value: unknown): value is BlueprintFactory {
  return typeof value === "function";
}

function isBlueprintLike(value: unknown): value is Partial<Blueprint> {
  return !!value && typeof value === "object";
}

function isCameraUpdate(value: unknown): value is CameraController["update"] {
  return typeof value === "function";
}

export function renderImage(
  getImageForThing: (thing: RuntimeThing) => CanvasImageSource | null,
  ctx: CanvasRenderingContext2D,
  thing: RuntimeThing
) {
  const image = getImageForThing ? getImageForThing(thing) : null;
  if (image) {
    ctx.drawImage(image, 0, 0, thing.width, thing.height);
  }
}
