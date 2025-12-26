import moveWithArrows from "./moveWithArrows";
import type { ActionDefinition } from "@/engine/types";

export type ActionRegistry = Record<string, ActionDefinition>;

export const actions: ActionRegistry = {
  moveWithArrows,
};
