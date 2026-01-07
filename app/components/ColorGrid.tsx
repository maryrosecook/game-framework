import {
  COLOR_OPTIONS,
  getColorOptions,
  getRandomColorOption,
} from "@/lib/colors";

export function ColorGrid({
  selected,
  onSelect,
  disabled = false,
}: {
  selected: string;
  onSelect: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`grid w-full grid-cols-6 gap-2 rounded-xl border border-slate-200 bg-white p-3 ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          className={`relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg border transition ${
            selected === color
              ? "border-2 border-blue-600 ring-2 ring-blue-300"
              : "border-slate-200 hover:border-slate-400"
          }`}
          style={{ backgroundColor: color }}
          onClick={() => {
            if (disabled) return;
            onSelect(color);
          }}
        />
      ))}
    </div>
  );
}

export { getColorOptions, getRandomColorOption };
