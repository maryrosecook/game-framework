import { describe, expect, it } from "vitest";
import { runBlueprintHandlers } from "./blueprints";
import {
  Blueprint,
  BlueprintBehaviors,
  COLLISION_TRIGGER_ANY,
  RuntimeThing,
} from "./types";

function makeBlueprint(
  name: string,
  behaviors: BlueprintBehaviors
): Blueprint {
  return {
    name,
    width: 10,
    height: 10,
    color: "#000000",
    shape: "rectangle",
    physicsType: "dynamic",
    weight: 1,
    bounce: 0,
    behaviors,
  };
}

function makeRuntimeThing(blueprintName: string): RuntimeThing {
  return {
    id: `${blueprintName}-id`,
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    velocityX: 0,
    velocityY: 0,
    isGrounded: false,
    blueprintName,
    width: 10,
    height: 10,
    color: "#000000",
  };
}

describe("runBlueprintHandlers collision filters", () => {
  it("runs collision actions when trigger is any", () => {
    const behaviors: BlueprintBehaviors = [
      {
        trigger: "collision",
        blueprint: COLLISION_TRIGGER_ANY,
        actions: [{ action: "destroy", settings: {} }],
      },
    ];
    const blueprint = makeBlueprint("actor", behaviors);
    const invoked: Array<unknown> = [];

    runBlueprintHandlers(
      "collision",
      blueprint,
      undefined,
      (handler) => {
        invoked.push(handler);
      },
      { otherThing: makeRuntimeThing("enemy") }
    );

    expect(invoked).toHaveLength(1);
  });

  it("filters collision actions to the selected blueprint", () => {
    const behaviors: BlueprintBehaviors = [
      {
        trigger: "collision",
        blueprint: "enemy",
        actions: [{ action: "destroy", settings: {} }],
      },
    ];
    const blueprint = makeBlueprint("actor", behaviors);
    const matchingInvoked: Array<unknown> = [];

    runBlueprintHandlers(
      "collision",
      blueprint,
      undefined,
      (handler) => {
        matchingInvoked.push(handler);
      },
      { otherThing: makeRuntimeThing("enemy") }
    );

    expect(matchingInvoked).toHaveLength(1);

    const nonMatchingInvoked: Array<unknown> = [];

    runBlueprintHandlers(
      "collision",
      blueprint,
      undefined,
      (handler) => {
        nonMatchingInvoked.push(handler);
      },
      { otherThing: makeRuntimeThing("friend") }
    );

    expect(nonMatchingInvoked).toHaveLength(0);
  });
});
