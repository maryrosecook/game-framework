"use client";

export function PaletteFlyover({
  open,
  colors,
  selected,
  onSelect,
}: {
  open: boolean;
  colors: string[];
  selected: string;
  onSelect: (color: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
      <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rotate-45 border-b border-r border-slate-200 bg-white" />
      <div className="grid grid-cols-6 gap-2 w-[216px]">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`h-6 w-6 cursor-pointer rounded-full border transition ${
              selected === color
                ? "border-slate-600 ring-2 ring-slate-200"
                : "border-slate-200 hover:border-slate-400"
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onSelect(color)}
            aria-label={`Select paint color ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
