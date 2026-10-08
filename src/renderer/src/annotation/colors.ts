export interface HighlightColor {
  id: string;
  label: string;
  value: string;
}

/** Shared highlight palette; `value` is what gets persisted in `Annotation.color`. */
export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { id: "yellow", label: "Yellow", value: "#ffe066" },
  { id: "green", label: "Green", value: "#8ce99a" },
  { id: "blue", label: "Blue", value: "#74c0fc" },
  { id: "pink", label: "Pink", value: "#f783ac" },
  { id: "purple", label: "Purple", value: "#b197fc" }
];

export const DEFAULT_COLOR = "#ffe066";

export function labelForColor(value: string | undefined): string {
  return HIGHLIGHT_COLORS.find((color) => color.value === value)?.label ?? "Yellow";
}
