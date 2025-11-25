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
  private handleKeyDown = (event: KeyboardEvent) => {
    const mapped = CODE_TO_KEY[event.code];
    if (!mapped) return;
    event.preventDefault();
    this.keyState[mapped] = true;
  };
  private handleKeyUp = (event: KeyboardEvent) => {
    const mapped = CODE_TO_KEY[event.code];
    if (!mapped) return;
    event.preventDefault();
    this.keyState[mapped] = false;
  };

  attach() {
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  detach() {
    if (typeof window === "undefined") return;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.keyState = { ...DEFAULT_STATE };
  }
}
