import { GameAction, RuntimeGameState, RuntimeThing, Vector } from "../../types";
import { PointerInputEvent } from "../../input";

export type PointerMode = "pointer" | "paint";

export type PointerInteractionContext = {
  dispatch: (action: GameAction) => void;
  beginEditing: (ids: string[]) => void;
  endEditing: (ids?: string[]) => void;
  hitTest: (worldPoint: Vector) => RuntimeThing | null;
  duplicateSelection: (
    selectedIds: string[],
    worldPoint: Vector
  ) => RuntimeThing[];
  getWorldPoint: (clientX: number, clientY: number) => Vector | null;
  capturePointer: (pointerId: number) => void;
  releasePointer: (pointerId: number) => void;
  pointerMode: PointerMode;
  paintColor: string;
  paintAt: (
    thing: RuntimeThing,
    worldPoint: Vector,
    previousWorldPoint?: Vector | null
  ) => void;
};

export type PointerInteractionSession = {
  capture?: boolean;
  onMove: (input: PointerMoveInput) => void;
  onUp: (input: PointerUpInput) => void;
  onCancel: (input: PointerCancelInput) => void;
};

export type PointerInteractionStrategy = {
  canStart: (input: PointerStartInput) => PointerInteractionSession | null;
};

export type PointerStartInput = {
  event: PointerInputEvent;
  worldPoint: Vector;
  hit: RuntimeThing | null;
  state: RuntimeGameState;
  context: PointerInteractionContext;
};

export type PointerMoveInput = {
  event: PointerInputEvent;
  worldPoint: Vector;
  state: RuntimeGameState;
  context: PointerInteractionContext;
};

export type PointerUpInput = {
  event: PointerInputEvent;
  worldPoint: Vector | null;
  state: RuntimeGameState;
  context: PointerInteractionContext;
};

export type PointerCancelInput = {
  event: PointerInputEvent;
  worldPoint: Vector | null;
  state: RuntimeGameState;
  context: PointerInteractionContext;
};

export type PointerDragTarget = {
  thingId: string;
  offsetX: number;
  offsetY: number;
};
