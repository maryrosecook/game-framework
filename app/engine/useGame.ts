"use client";

import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { GameEngine, GameEngineDependencies } from "./engine";
import { GameAction, SubscriptionPath } from "./types";
import { createGameEngineDependencies } from "@/lib/gameApiClient";
import { getBlueprintManifestVersion } from "@games/blueprint-manifest-index";

export type GameSubscribe = <T = unknown>(
  path: SubscriptionPath
) => readonly [T, (action: GameAction) => void];

type UseGameOptions = {
  editKey?: string | null;
  onEditAccess?: (canEdit: boolean) => void;
  isReadOnly?: boolean;
};

export function useGame(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  gameDirectory: string,
  options: UseGameOptions = {}
): { isPaused: boolean; subscribe: GameSubscribe; engine: GameEngine } {
  const { editKey, onEditAccess, isReadOnly } = options;
  const dependenciesRef = useRef<GameEngineDependencies | null>(null);
  const dependencies =
    dependenciesRef.current ??
    (dependenciesRef.current = createGameEngineDependencies({
      editKey,
      onEditAccess,
    }));
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine(dependencies);
  }

  const engine = engineRef.current!;
  const manifestVersion = getBlueprintManifestVersion(gameDirectory);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engine.initialize(canvas, gameDirectory);
    return () => {
      engine.destroy();
    };
  }, [canvasRef, engine, gameDirectory]);

  useEffect(() => {
    void engine.hotReloadBlueprints(manifestVersion);
  }, [engine, manifestVersion]);

  useEffect(() => {
    engine.setIsReadOnly(!!isReadOnly);
  }, [engine, isReadOnly]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ game: string; version: string }>)[
        "detail"
      ];
      if (detail?.game === gameDirectory) {
        void engine.hotReloadBlueprints(detail.version);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("blueprint-manifest-updated", handler as EventListener);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "blueprint-manifest-updated",
          handler as EventListener
        );
      }
    };
  }, [engine, gameDirectory]);

  const dispatch = useCallback(
    (action: GameAction) => {
      engine.dispatch(action);
    },
    [engine]
  );

  const subscribe = useMemo(() => {
    const handler = (<T,>(
      path: SubscriptionPath
    ): readonly [T, (action: GameAction) => void] => {
      const getSnapshot = () => engine.getStateAtPath(path) as T;
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const state = useSyncExternalStore(
        engine.subscribeStore,
        getSnapshot,
        getSnapshot
      );
      return [state, dispatch] as const;
    }) as GameSubscribe;
    return handler;
  }, [dispatch, engine]);

  const isPaused = useSyncExternalStore(
    engine.subscribeStore,
    () => engine.getStateAtPath(["isPaused"]) as boolean,
    () => true
  );

  return useMemo(
    () => ({
      isPaused,
      subscribe,
      engine,
    }),
    [engine, isPaused, subscribe]
  );
}
