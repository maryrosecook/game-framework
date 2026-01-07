export const COLOR_OPTIONS = [
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

export function getColorOptions(): string[] {
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
