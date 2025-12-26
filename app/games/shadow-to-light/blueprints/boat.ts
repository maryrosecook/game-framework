import {
  BlueprintData,
  GameContext,
  RuntimeThing,
  Vector,
} from "@/engine/types";

export default function createBlueprint19(data: BlueprintData) {
  return {
    ...data,
    getAdjustedVelocity: (
      thing: RuntimeThing,
      proposedVelocity: Vector,
      game: GameContext
    ) => {
      if (proposedVelocity.x === 0 && proposedVelocity.y === 0) {
        return proposedVelocity;
      }

      const nextBounds = {
        left: thing.x + proposedVelocity.x,
        right: thing.x + proposedVelocity.x + thing.width,
        top: thing.y + proposedVelocity.y,
        bottom: thing.y + proposedVelocity.y + thing.height,
      };

      const touchesWater = game.gameState.things.some((candidate) => {
        if (candidate.blueprintName !== "water") {
          return false;
        }
        return rectanglesOverlap(
          nextBounds,
          candidate.x,
          candidate.y,
          candidate.width,
          candidate.height
        );
      });

      return touchesWater ? proposedVelocity : { x: 0, y: 0 };
    },
  };
}

function rectanglesOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  x: number,
  y: number,
  width: number,
  height: number
) {
  const b = { left: x, right: x + width, top: y, bottom: y + height };
  return !(
    a.left >= b.right ||
    a.right <= b.left ||
    a.top >= b.bottom ||
    a.bottom <= b.top
  );
}
