import { KeyState } from "./types";

const DEFAULT_STATE: KeyState = {
  arrowLeft: false,
  arrowRight: false,
  arrowUp: false,
  arrowDown: false,
  digit0: false,
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
  Digit0: "digit0",
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
  };

  private handleWindowFocus = () => {
    this.windowFocused = true;
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
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("focus", this.handleWindowFocus);
  }

  detach() {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("focus", this.handleWindowFocus);
    this.keyState = { ...DEFAULT_STATE };
  }

  private resetKeys() {
    this.keyState = { ...DEFAULT_STATE };
  }
}
