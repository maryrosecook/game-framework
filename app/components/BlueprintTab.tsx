import { Copy, Plus, Trash2 } from "lucide-react";
import {
  Blueprint,
  BlueprintData,
  DEFAULT_THING_Z,
  GameAction,
  RawThing,
  SetBlueprintPropertyAction,
} from "@/engine/types";
import { SelectField } from "@/components/SelectField";
import { ArrangeButton } from "@/components/ArrangeButton";
import { getBlueprintImageUrl } from "@/lib/images";

type BlueprintTabProps = {
  blueprint: Blueprint;
  things: RawThing[];
  selectedThingId: string | null;
  gameDirectory: string;
  dispatch: (action: GameAction) => void;
  onRename: (value: string) => void;
  imageVersion?: number;
  onClone: () => void;
  canClone: boolean;
  onCreate: () => void;
};

export function BlueprintTab({
  blueprint,
  things,
  selectedThingId,
  gameDirectory,
  dispatch,
  onRename,
  imageVersion,
  onClone,
  canClone,
  onCreate,
}: BlueprintTabProps) {
  const imageUrl = getBlueprintImageUrl(
    gameDirectory,
    blueprint.image,
    imageVersion
  );
  const orderedThings = getOrderedThings(things);
  const selectedIndex = selectedThingId
    ? orderedThings.findIndex((entry) => entry.thing.id === selectedThingId)
    : -1;
  const canMoveUp =
    selectedIndex >= 0 && selectedIndex < orderedThings.length - 1;
  const canMoveDown = selectedIndex > 0;

  const handleUpdate = <K extends keyof BlueprintData>(
    property: K,
    value: BlueprintData[K]
  ) => {
    dispatch(buildBlueprintPropertyAction(blueprint.name, property, value));
  };

  const handleRename = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === blueprint.name) {
      return;
    }
    dispatch({
      type: "renameBlueprint",
      previousName: blueprint.name,
      nextName: trimmed,
    });
    onRename(trimmed);
  };

  const handleDeleteBlueprint = () => {
    const confirmed = window.confirm(
      "Delete this blueprint? This cannot be undone."
    );
    if (!confirmed) {
      return;
    }
    dispatch({
      type: "removeBlueprint",
      blueprintName: blueprint.name,
    });
  };

  const setSelectedZ = (nextZ: number) => {
    if (!selectedThingId) {
      return;
    }
    dispatch({
      type: "setThingProperty",
      thingId: selectedThingId,
      property: "z",
      value: nextZ,
    });
  };

  const handleMoveToTop = () => {
    if (!canMoveUp) {
      return;
    }
    const topZ = orderedThings[orderedThings.length - 1]?.z ?? DEFAULT_THING_Z;
    setSelectedZ(topZ + 1);
  };

  const handleMoveUp = () => {
    if (!canMoveUp) {
      return;
    }
    const above = orderedThings[selectedIndex + 1];
    if (!above) {
      return;
    }
    const aboveAbove = orderedThings[selectedIndex + 2];
    const nextZ =
      aboveAbove && aboveAbove.z > above.z
        ? (above.z + aboveAbove.z) / 2
        : above.z + 1;
    setSelectedZ(nextZ);
  };

  const handleMoveDown = () => {
    if (!canMoveDown) {
      return;
    }
    const below = orderedThings[selectedIndex - 1];
    if (!below) {
      return;
    }
    const belowBelow = orderedThings[selectedIndex - 2];
    const nextZ =
      belowBelow && belowBelow.z < below.z
        ? (below.z + belowBelow.z) / 2
        : below.z - 1;
    setSelectedZ(nextZ);
  };

  const handleMoveToBottom = () => {
    if (!canMoveDown) {
      return;
    }
    const bottomZ = orderedThings[0]?.z ?? DEFAULT_THING_Z;
    setSelectedZ(bottomZ - 1);
  };

  return (
    <>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Blueprint
        </p>
        <div className="mt-1 flex items-stretch gap-2">
          <input
            key={blueprint.name}
            className="h-9 w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
            defaultValue={blueprint.name}
            onBlur={(event) => {
              handleRename(event.target.value);
            }}
          />
          <div
            className="relative h-9 w-9 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            style={imageUrl ? undefined : { backgroundColor: blueprint.color }}
            aria-hidden="true"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${blueprint.name} image`}
                className="h-full w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ArrangeButton
            label="Create"
            icon={<Plus className="size-4" />}
            onClick={onCreate}
            fullWidth={false}
            className="gap-1 px-2 py-1 text-xs"
            ariaLabel="Create a new thing in the center of the screen"
          />
          <ArrangeButton
            label="Clone"
            icon={<Copy className="size-4" />}
            onClick={onClone}
            disabled={!canClone}
            fullWidth={false}
            className="gap-1 px-2 py-1 text-xs"
            ariaLabel="Clone selected items"
          />
          <ArrangeButton
            label="Delete"
            icon={<Trash2 className="size-4" />}
            onClick={handleDeleteBlueprint}
            fullWidth={false}
            className="gap-1 px-2 py-1 text-xs border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
            ariaLabel="Delete"
          />
        </div>
      </header>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 items-center">
          <ArrangeButton
            label="Top"
            icon="↑↑"
            onClick={handleMoveToTop}
            disabled={!canMoveUp}
          />
          <ArrangeButton
            label="Up"
            icon="↑"
            onClick={handleMoveUp}
            disabled={!canMoveUp}
          />
          <ArrangeButton
            label="Bottom"
            icon="↓↓"
            onClick={handleMoveToBottom}
            disabled={!canMoveDown}
          />
          <ArrangeButton
            label="Down"
            icon="↓"
            onClick={handleMoveDown}
            disabled={!canMoveDown}
          />
        </div>
        <SelectField
          label="Shape"
          value={blueprint.shape}
          options={[
            { label: "Rectangle", value: "rectangle" },
            { label: "Triangle", value: "triangle" },
            { label: "Circle", value: "circle" },
          ]}
          onChange={(value) => handleUpdate("shape", value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
            Width
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
              value={blueprint.width}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (!Number.isFinite(nextValue)) {
                  return;
                }
                handleUpdate("width", nextValue);
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
            Height
            <input
              type="number"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
              value={blueprint.height}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (!Number.isFinite(nextValue)) {
                  return;
                }
                handleUpdate("height", nextValue);
              }}
            />
          </label>
        </div>
        <SelectField
          label="Physics"
          value={blueprint.physicsType}
          options={[
            { label: "Slider", value: "dynamic" },
            { label: "Stopper", value: "static" },
            { label: "Ghost", value: "ambient" },
          ]}
          onChange={(value) => handleUpdate("physicsType", value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Weight"
            value={resolveNumericOption(blueprint.weight, WEIGHT_OPTIONS)}
            options={WEIGHT_OPTIONS}
            onChange={(value) => handleUpdate("weight", Number(value))}
          />
          <SelectField
            label="Bounce"
            value={resolveNumericOption(blueprint.bounce, BOUNCE_OPTIONS)}
            options={BOUNCE_OPTIONS}
            onChange={(value) => handleUpdate("bounce", Number(value))}
          />
        </div>
      </div>
    </>
  );
}

type OrderedThing = {
  thing: RawThing;
  index: number;
  z: number;
};

function getOrderedThings(things: RawThing[]): OrderedThing[] {
  return things
    .map((entry, index) => ({
      thing: entry,
      index,
      z: entry.z ?? DEFAULT_THING_Z,
    }))
    .sort((a, b) => {
      if (a.z !== b.z) {
        return a.z - b.z;
      }
      return a.index - b.index;
    });
}

function buildBlueprintPropertyAction(
  name: string,
  property: keyof BlueprintData,
  value: BlueprintData[keyof BlueprintData]
): SetBlueprintPropertyAction {
  switch (property) {
    case "width":
    case "height":
      if (typeof value !== "number") {
        throw new Error("Blueprint dimension must be a number.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    case "weight":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("Weight must be a number.");
      }
      if (!WEIGHT_VALUES.includes(value)) {
        throw new Error("Weight must be low, medium, or high.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    case "bounce":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error("Bounce must be a number.");
      }
      if (!BOUNCE_VALUES.includes(value)) {
        throw new Error("Bounce must be none, some, or lots.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    case "shape":
      if (value !== "rectangle" && value !== "triangle" && value !== "circle") {
        throw new Error("Shape must be a valid option.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    case "physicsType":
      if (value !== "dynamic" && value !== "static" && value !== "ambient") {
        throw new Error("Physics type must be a valid option.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    case "color":
    case "name":
      if (typeof value !== "string") {
        throw new Error("Blueprint field must be a string.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    case "image":
      if (value !== undefined && typeof value !== "string") {
        throw new Error("Blueprint image must be a string filename.");
      }
      return {
        type: "setBlueprintProperty",
        blueprintName: name,
        property,
        value,
      };
    default:
      throw new Error("Unknown blueprint property.");
  }
}

const WEIGHT_OPTIONS = [
  { label: "Low", value: "1" },
  { label: "Medium", value: "3" },
  { label: "High", value: "6" },
];

const BOUNCE_OPTIONS = [
  { label: "None", value: "0" },
  { label: "Some", value: "0.5" },
  { label: "Lots", value: "1" },
];

const WEIGHT_VALUES = WEIGHT_OPTIONS.map((option) => Number(option.value));
const BOUNCE_VALUES = BOUNCE_OPTIONS.map((option) => Number(option.value));

function resolveNumericOption(
  value: number,
  options: { value: string }[]
) {
  if (!Number.isFinite(value)) {
    return options[0].value;
  }
  let closest = options[0].value;
  let bestDistance = Infinity;
  for (const option of options) {
    const candidate = Number(option.value);
    const distance = Math.abs(value - candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = option.value;
    }
  }
  return closest;
}
