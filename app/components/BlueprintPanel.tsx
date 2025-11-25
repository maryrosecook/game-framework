import { DragEvent, useState } from "react";
import { Blueprint } from "@/engine/types";
import { GameSubscribe } from "@/engine/useGame";
import { GameEngine } from "@/engine/engine";
import { ColorGrid } from "@/components/ColorGrid";
import { SelectField } from "@/components/SelectField";
import { getBlueprintImageUrl } from "@/lib/images";

export function BlueprintPanel({
  blueprintName,
  subscribe,
  engine,
  onRename,
  gameDirectory,
}: {
  blueprintName: string;
  subscribe: GameSubscribe;
  engine: GameEngine;
  onRename: (next: string) => void;
  gameDirectory: string;
}) {
  const [blueprint, dispatchBlueprint] = subscribe<Blueprint | undefined>([
    "blueprints",
    blueprintName,
  ]);
  const [isPaused] = subscribe<boolean>(["isPaused"]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!blueprint) {
    return null;
  }

  const updateField = (property: keyof Blueprint, value: string | number) => {
    if (!isPaused) return;
    dispatchBlueprint({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property,
      value,
    });
  };

  const handleRename = (value: string) => {
    if (!isPaused) return;
    const trimmed = value.trim();
    if (!trimmed || trimmed === blueprint.name) {
      return;
    }
    const previousName = blueprint.name;
    engine.dispatch({
      type: "renameBlueprint",
      previousName,
      nextName: trimmed,
    });
    onRename(trimmed);
  };

  const handleImageDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isPaused) return;
    const [file] = Array.from(event.dataTransfer.files ?? []);
    if (!file) return;
    if (
      file.type !== "image/png" &&
      !file.name.toLowerCase().endsWith(".png")
    ) {
      setUploadError("Only PNG files are supported.");
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("gameDirectory", gameDirectory);
      formData.append("blueprintName", blueprint.name);
      formData.append("file", file);
      const response = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setUploadError(payload?.error ?? "Failed to save image.");
        return;
      }
      const payload = (await response.json()) as { fileName?: string };
      const fileName =
        payload && typeof payload.fileName === "string"
          ? payload.fileName
          : file.name;
      setUploadError(null);
      dispatchBlueprint({
        type: "setBlueprintProperty",
        blueprintName: blueprint.name,
        property: "image",
        value: fileName,
      });
    } catch (error) {
      console.warn("Image upload failed", error);
      setUploadError("Failed to save image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearImage = () => {
    if (!isPaused) return;
    dispatchBlueprint({
      type: "setBlueprintProperty",
      blueprintName: blueprint.name,
      property: "image",
      value: undefined,
    });
  };

  const imageUrl = getBlueprintImageUrl(gameDirectory, blueprint.image);

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-xl">
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
          disabled={!isPaused}
        />
      </header>
      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Image
          </p>
          <div
            className={`mt-1 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-dashed ${
              isPaused
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 bg-slate-100"
            } ${isUploading ? "opacity-70" : ""}`}
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
                {isPaused
                  ? "Drop a PNG here to use it for this blueprint"
                  : "Pause to set an image"}
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
                disabled={!isPaused || isUploading}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="W"
            value={blueprint.width}
            onChange={(value) => updateField("width", value)}
            disabled={!isPaused}
          />
          <Field
            label="H"
            value={blueprint.height}
            onChange={(value) => updateField("height", value)}
            disabled={!isPaused}
          />
        </div>
        <SelectField
          label="Shape"
          value={blueprint.shape}
          options={[
            { label: "Rectangle", value: "rectangle" },
            { label: "Triangle", value: "triangle" },
          ]}
          onChange={(value) => updateField("shape", value)}
          disabled={!isPaused}
        />
        <SelectField
          label="Physics"
          value={blueprint.physicsType}
          options={[
            { label: "Dynamic", value: "dynamic" },
            { label: "Static", value: "static" },
            { label: "Ambient (no pushback)", value: "ambient" },
          ]}
          onChange={(value) => updateField("physicsType", value)}
          disabled={!isPaused}
        />
        <Field
          label="Z"
          value={blueprint.z}
          onChange={(value) => updateField("z", value)}
          disabled={!isPaused}
        />
        <ColorGrid
          selected={blueprint.color}
          onSelect={(color) => updateField("color", color)}
          disabled={!isPaused}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
      {label}
      <input
        type="number"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-400"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}
