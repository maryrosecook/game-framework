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
      className={`grid grid-cols-5 gap-1.5 rounded-xl border border-slate-200 bg-white p-3 ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          className={`relative h-10 w-10 cursor-pointer overflow-hidden rounded-lg border transition ${
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
