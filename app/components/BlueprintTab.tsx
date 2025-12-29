import { DragEvent, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import {
  Blueprint,
  BlueprintData,
  GameAction,
  SetBlueprintPropertyAction,
} from "@/engine/types";
import { getColorOptions } from "@/components/ColorGrid";
import { ColorSelect } from "@/components/ColorSelect";
import { SelectField } from "@/components/SelectField";
import { ArrangeButton } from "@/components/ArrangeButton";
import { getBlueprintImageUrl } from "@/lib/images";
import { getDroppedPngFile, uploadBlueprintImage } from "@/lib/imageUploads";

type BlueprintTabProps = {
  blueprint: Blueprint;
  blueprints: Blueprint[];
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
  blueprints,
  gameDirectory,
  dispatch,
  onRename,
  imageVersion,
  onClone,
  canClone,
  onCreate,
}: BlueprintTabProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const imageUrl = getBlueprintImageUrl(
    gameDirectory,
    blueprint.image,
    imageVersion
  );
  const zBounds = getZBounds(blueprints, blueprint.z);
  const colorOptions = getColorOptions();

  const handleUpdate = <K extends keyof BlueprintData>(
    property: K,
    value: BlueprintData[K]
  ) => {
    dispatch(buildBlueprintPropertyAction(blueprint.name, property, value));
  };

  const handleImageDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { file, error } = getDroppedPngFile(event);
    if (error) {
      setUploadError(error);
      return;
    }
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const fileName = await uploadBlueprintImage({
        gameDirectory,
        blueprintName: blueprint.name,
        file,
      });
      handleUpdate("image", fileName);
    } catch (error) {
      console.warn("Image upload failed", error);
      const message =
        error instanceof Error ? error.message : "Failed to save image.";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearImage = () => {
    handleUpdate("image", undefined);
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

  const handleSendToFront = () => {
    const targetZ =
      blueprint.z >= zBounds.maxZ ? blueprint.z : zBounds.maxZ + 1;
    if (targetZ !== blueprint.z) {
      handleUpdate("z", targetZ);
    }
  };

  const handleSendToBack = () => {
    const targetZ =
      blueprint.z <= zBounds.minZ ? blueprint.z : zBounds.minZ - 1;
    if (targetZ !== blueprint.z) {
      handleUpdate("z", targetZ);
    }
  };

  return (
    <>
      <header className="mb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Blueprint
        </p>
        <input
          key={blueprint.name}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-400"
          defaultValue={blueprint.name}
          onBlur={(event) => {
            handleRename(event.target.value);
          }}
        />
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
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Image
          </p>
          <div
            className={`mt-1 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-dashed ${"border-slate-300 bg-slate-50"} ${
              isUploading ? "opacity-70" : ""
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleImageDrop}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${blueprint.name} image`}
                className="h-full w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : (
              <p className="px-3 text-center text-xs text-slate-500">
                Drop a PNG here to use it for this blueprint
              </p>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {isUploading ? "Uploading…" : uploadError ?? "\u00A0"}
            </p>
            {blueprint.image ? (
              <button
                type="button"
                className="text-xs text-slate-600 underline decoration-slate-400 decoration-2 underline-offset-2 disabled:cursor-not-allowed disabled:text-slate-300"
                onClick={handleClearImage}
                disabled={isUploading}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 items-center">
          <ArrangeButton
            label="Front"
            icon="↑"
            onClick={handleSendToFront}
            disabled={blueprint.z >= zBounds.maxZ}
          />
          <ArrangeButton
            label="Back"
            icon="↓"
            onClick={handleSendToBack}
            disabled={blueprint.z <= zBounds.minZ}
          />
          <input
            type="number"
            className="w-12 justify-self-end rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={blueprint.z}
            onChange={(event) =>
              handleUpdate("z", Number(event.target.value) || 0)
            }
            aria-label="Z position"
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
        <ColorSelect
          label="Color"
          value={blueprint.color}
          options={colorOptions}
          onChange={(value) => handleUpdate("color", value)}
        />
      </div>
    </>
  );
}

function getZBounds(blueprints: Blueprint[], fallback: number) {
  if (blueprints.length === 0) {
    return { minZ: fallback, maxZ: fallback };
  }
  let minZ = blueprints[0].z;
  let maxZ = blueprints[0].z;
  for (const blueprint of blueprints) {
    minZ = Math.min(minZ, blueprint.z);
    maxZ = Math.max(maxZ, blueprint.z);
  }
  return { minZ, maxZ };
}

function buildBlueprintPropertyAction(
  name: string,
  property: keyof BlueprintData,
  value: BlueprintData[keyof BlueprintData]
): SetBlueprintPropertyAction {
  switch (property) {
    case "width":
    case "height":
    case "z":
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
