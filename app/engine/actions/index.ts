import moveWithArrows from "./definitions/moveWithArrows";
import spawnObject from "./definitions/spawnObject";
import destroy from "./definitions/destroy";
import moveForward from "./definitions/moveForward";
import turn from "./definitions/turn";
import type { ActionDefinition } from "@/engine/types";

export type ActionRegistry = Record<string, ActionDefinition>;

export const actions: ActionRegistry = {
  moveWithArrows,
  spawnObject,
  destroy,
  moveForward,
  turn,
};
