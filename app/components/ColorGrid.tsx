const COLOR_OPTIONS = [
  "#000000",
  "#1a1a1a",
  "#666666",
  "#ffffff",
  "#8b0000",
  "#ff0000",
  "#ff6b6b",
  "#ffb3b3",
  "#8b4500",
  "#ff8c00",
  "#ffa500",
  "#ffd700",
  "#006400",
  "#32cd32",
  "#90ee90",
  "#98fb98",
  "#000080",
  "#0066ff",
  "#87ceeb",
  "#add8e6",
  "#4b0082",
  "#9932cc",
  "#da70d6",
  "#e6e6fa",
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

export function getColorOptions() {
  return [...COLOR_OPTIONS];
}

export function getRandomColorOption(colors?: string[]): string {
  const options = colors && colors.length > 0 ? colors : getColorOptions();
  if (options.length === 0) {
    throw new Error("No color options available.");
  }
  const index = Math.floor(Math.random() * options.length);
  const selected = options[index];
  if (!selected) {
    throw new Error("Failed to select a color option.");
  }
  return selected;
}
