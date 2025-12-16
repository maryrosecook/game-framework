import { KeyState } from "./types";

export type PointerInputEventType =
  | "down"
  | "move"
  | "up"
  | "cancel"
  | "leave";

export type PointerInputEvent = {
  type: PointerInputEventType;
  pointerId: number;
  clientX: number;
  clientY: number;
  altKey: boolean;
  shiftKey: boolean;
};

const DEFAULT_STATE: KeyState = {
  arrowLeft: false,
  arrowRight: false,
  arrowUp: false,
  arrowDown: false,
  digit1: false,
  digit0: false,
  digit9: false,
  space: false,
  shift: false,
  keyW: false,
  keyA: false,
  keyS: false,
  keyD: false,
  keyE: false,
};

const CODE_TO_KEY: Partial<Record<KeyboardEvent["code"], keyof KeyState>> = {
  ArrowLeft: "arrowLeft",
  ArrowRight: "arrowRight",
  ArrowUp: "arrowUp",
  ArrowDown: "arrowDown",
  Digit1: "digit1",
  Digit0: "digit0",
  Digit9: "digit9",
  Space: "space",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  KeyW: "keyW",
  KeyA: "keyA",
  KeyS: "keyS",
  KeyD: "keyD",
  KeyE: "keyE",
};

export class InputManager {
  keyState: KeyState = { ...DEFAULT_STATE };
  private windowFocused = true;
  private pointerEvents: PointerInputEvent[] = [];
  private pointerTarget: HTMLCanvasElement | null = null;
  private keyboardAttached = false;
  private pointerAttached = false;
  private activePointerIds = new Set<number>();
  private capturedPointerIds = new Set<number>();

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.windowFocused || this.shouldIgnoreTarget(event)) {
      this.resetKeys();
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    const mapped = CODE_TO_KEY[event.code];
    if (!mapped) return;
    event.preventDefault();
    this.keyState[mapped] = true;
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (!this.windowFocused || this.shouldIgnoreTarget(event)) {
      this.resetKeys();
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    const mapped = CODE_TO_KEY[event.code];
    if (!mapped) return;
    event.preventDefault();
    this.keyState[mapped] = false;
  };

  private handleWindowBlur = () => {
    this.windowFocused = false;
    this.resetKeys();
    this.cancelActivePointers();
  };

  private handleWindowFocus = () => {
    this.windowFocused = true;
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (!this.windowFocused) return;
    this.enqueuePointerEvent("down", event);
    this.activePointerIds.add(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.windowFocused) return;
    this.enqueuePointerEvent("move", event);
  };

  private handlePointerUp = (event: PointerEvent) => {
    this.enqueuePointerEvent("up", event);
    this.activePointerIds.delete(event.pointerId);
    this.capturedPointerIds.delete(event.pointerId);
  };

  private handlePointerCancel = (event: PointerEvent) => {
    this.enqueuePointerEvent("cancel", event);
    this.activePointerIds.delete(event.pointerId);
    this.releasePointerCapture(event.pointerId);
  };

  private handlePointerLeave = (event: PointerEvent) => {
    this.enqueuePointerEvent("leave", event);
    this.activePointerIds.delete(event.pointerId);
    this.releasePointerCapture(event.pointerId);
  };

  private shouldIgnoreTarget(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    if (target.isContentEditable) {
      return true;
    }
    return /^(input|textarea|select)$/i.test(target.tagName);
  }

  attach() {
    if (typeof window === "undefined" || this.keyboardAttached) return;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("focus", this.handleWindowFocus);
    this.keyboardAttached = true;
  }

  detach() {
    if (typeof window !== "undefined" && this.keyboardAttached) {
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
      window.removeEventListener("blur", this.handleWindowBlur);
      window.removeEventListener("focus", this.handleWindowFocus);
      this.keyboardAttached = false;
    }
    this.unbindPointerTarget();
    this.keyState = { ...DEFAULT_STATE };
  }

  bindPointerTarget(target: HTMLCanvasElement | null) {
    if (this.pointerTarget === target) {
      return;
    }
    this.unbindPointerTarget();
    if (!target) {
      return;
    }
    target.addEventListener("pointerdown", this.handlePointerDown);
    target.addEventListener("pointermove", this.handlePointerMove);
    target.addEventListener("pointerup", this.handlePointerUp);
    target.addEventListener("pointercancel", this.handlePointerCancel);
    target.addEventListener("pointerleave", this.handlePointerLeave);
    this.pointerTarget = target;
    this.pointerAttached = true;
  }

  consumePointerEvents() {
    const events = this.pointerEvents;
    this.pointerEvents = [];
    return events;
  }

  capturePointer(pointerId: number) {
    if (!this.pointerTarget) return;
    try {
      this.pointerTarget.setPointerCapture(pointerId);
      this.capturedPointerIds.add(pointerId);
    } catch (error) {
      console.warn("Failed to capture pointer", error);
    }
  }

  releasePointerCapture(pointerId: number) {
    if (!this.pointerTarget) return;
    try {
      if (this.pointerTarget.hasPointerCapture(pointerId)) {
        this.pointerTarget.releasePointerCapture(pointerId);
      }
      this.capturedPointerIds.delete(pointerId);
    } catch (error) {
      console.warn("Failed to release pointer", error);
    }
  }

  private unbindPointerTarget() {
    if (!this.pointerTarget || !this.pointerAttached) {
      return;
    }
    this.pointerTarget.removeEventListener("pointerdown", this.handlePointerDown);
    this.pointerTarget.removeEventListener("pointermove", this.handlePointerMove);
    this.pointerTarget.removeEventListener("pointerup", this.handlePointerUp);
    this.pointerTarget.removeEventListener("pointercancel", this.handlePointerCancel);
    this.pointerTarget.removeEventListener("pointerleave", this.handlePointerLeave);
    this.releaseAllPointerCaptures();
    this.pointerTarget = null;
    this.pointerAttached = false;
    this.activePointerIds.clear();
  }

  private enqueuePointerEvent(
    type: PointerInputEventType,
    event: PointerEvent
  ) {
    this.pointerEvents.push({
      type,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey,
      shiftKey: event.shiftKey,
    });
  }

  private resetKeys() {
    this.keyState = { ...DEFAULT_STATE };
  }

  private cancelActivePointers() {
    if (this.activePointerIds.size === 0) return;
    for (const pointerId of this.activePointerIds) {
      this.pointerEvents.push({
        type: "cancel",
        pointerId,
        clientX: 0,
        clientY: 0,
        altKey: false,
        shiftKey: false,
      });
      this.releasePointerCapture(pointerId);
    }
    this.activePointerIds.clear();
  }

  private releaseAllPointerCaptures() {
    for (const pointerId of this.capturedPointerIds) {
      this.releasePointerCapture(pointerId);
    }
    this.capturedPointerIds.clear();
  }
}
