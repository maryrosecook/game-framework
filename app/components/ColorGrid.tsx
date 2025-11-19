const COLOR_OPTIONS = [
  "#b399ff",
  "#99b3ff",
  "#99d6ff",
  "#ffcc99",
  "#ff9966",
  "#99e6cc",
  "#66cc99",
  "#ffb3cc",
  "#ff6699",
  "#f5f5f5",
  "#d9d9d9",
  "#b3b3b3",
  "#4d4d4d",
];

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
      className={`flex flex-wrap gap-2 ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          className={`size-6 cursor-pointer rounded-full border transition ${
            selected === color
              ? "border-slate-500 ring-2 ring-slate-200"
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

export function getColorOptions() {
  return [...COLOR_OPTIONS];
}
