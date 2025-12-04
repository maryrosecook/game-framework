import { PointerInputEvent } from "../../input";
import { RuntimeGameState } from "../../types";
import {
  PointerInteractionSession,
  PointerInteractionStrategy,
  PointerInteractionContext,
} from "./types";

type SessionEntry = {
  session: PointerInteractionSession;
  captured: boolean;
};

export class PointerInterpreter {
  private readonly sessions = new Map<number, SessionEntry>();

  constructor(private readonly strategies: PointerInteractionStrategy[]) {}

  process(
    events: PointerInputEvent[],
    getState: () => RuntimeGameState,
    context: PointerInteractionContext
  ) {
    for (const event of events) {
      switch (event.type) {
        case "down":
          this.handleDown(event, getState, context);
          break;
        case "move":
          this.handleMove(event, getState, context);
          break;
        case "up":
          this.handleUp(event, getState, context);
          break;
        case "cancel":
        case "leave":
          this.handleCancel(event, getState, context);
          break;
        default:
          break;
      }
    }
  }

  reset() {
    this.sessions.clear();
  }

  private handleDown(
    event: PointerInputEvent,
    getState: () => RuntimeGameState,
    context: PointerInteractionContext
  ) {
    if (this.sessions.has(event.pointerId)) {
      return;
    }
    const worldPoint = context.getWorldPoint(event.clientX, event.clientY);
    if (!worldPoint) {
      return;
    }
    const hit = context.hitTest(worldPoint);
    const state = getState();

    for (const strategy of this.strategies) {
      const session = strategy.canStart({
        event,
        worldPoint,
        hit,
        state,
        context,
      });
      if (!session) {
        continue;
      }
      const captured = session.capture !== false;
      if (captured) {
        context.capturePointer(event.pointerId);
      }
      this.sessions.set(event.pointerId, { session, captured });
      return;
    }
  }

  private handleMove(
    event: PointerInputEvent,
    getState: () => RuntimeGameState,
    context: PointerInteractionContext
  ) {
    const entry = this.sessions.get(event.pointerId);
    if (!entry) {
      return;
    }
    const worldPoint = context.getWorldPoint(event.clientX, event.clientY);
    if (!worldPoint) {
      return;
    }
    entry.session.onMove({
      event,
      worldPoint,
      state: getState(),
      context,
    });
  }

  private handleUp(
    event: PointerInputEvent,
    getState: () => RuntimeGameState,
    context: PointerInteractionContext
  ) {
    const entry = this.sessions.get(event.pointerId);
    if (!entry) {
      return;
    }
    entry.session.onUp({
      event,
      worldPoint: context.getWorldPoint(event.clientX, event.clientY),
      state: getState(),
      context,
    });
    if (entry.captured) {
      context.releasePointer(event.pointerId);
    }
    this.sessions.delete(event.pointerId);
  }

  private handleCancel(
    event: PointerInputEvent,
    getState: () => RuntimeGameState,
    context: PointerInteractionContext
  ) {
    const entry = this.sessions.get(event.pointerId);
    if (entry) {
      entry.session.onCancel({
        event,
        worldPoint: context.getWorldPoint(event.clientX, event.clientY),
        state: getState(),
        context,
      });
      if (entry.captured) {
        context.releasePointer(event.pointerId);
      }
      this.sessions.delete(event.pointerId);
    } else {
      context.releasePointer(event.pointerId);
    }
  }
}
